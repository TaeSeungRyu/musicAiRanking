import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

// data 디렉토리에 sqlite 파일 생성 (없으면 자동 생성)
const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "ranking.db");

// Next.js dev 모드의 HMR로 인한 커넥션 중복 생성을 막기 위해 전역에 캐싱
const globalForDb = globalThis as unknown as { db?: Database.Database };

export const db =
  globalForDb.db ??
  (() => {
    const instance = new Database(dbPath);
    instance.pragma("journal_mode = WAL");
    instance.exec(`
      CREATE TABLE IF NOT EXISTS tracks (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id    TEXT NOT NULL UNIQUE,
        title       TEXT NOT NULL,
        channel     TEXT,
        thumbnail   TEXT,
        view_count  INTEGER NOT NULL DEFAULT 0,
        url         TEXT NOT NULL,
        is_target   INTEGER NOT NULL DEFAULT 0,
        source_key  TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS channels (
        key        TEXT PRIMARY KEY,
        name       TEXT,
        url        TEXT,
        is_target  INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS meta (
        key   TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    // 기존 DB 마이그레이션: 없으면 컬럼 추가
    const cols = new Set(
      (instance.prepare("PRAGMA table_info(tracks)").all() as { name: string }[]).map(
        (c) => c.name
      )
    );
    if (!cols.has("is_target")) {
      instance.exec("ALTER TABLE tracks ADD COLUMN is_target INTEGER NOT NULL DEFAULT 0");
    }
    if (!cols.has("source_key")) {
      instance.exec("ALTER TABLE tracks ADD COLUMN source_key TEXT");
    }
    return instance;
  })();

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}

export interface Track {
  id: number;
  video_id: string;
  title: string;
  channel: string | null;
  thumbnail: string | null;
  view_count: number;
  url: string;
  is_target: number;
  source_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface Channel {
  key: string;
  name: string | null;
  url: string | null;
  is_target: number;
  created_at: string;
  track_count: number;
}

const insertStmt = db.prepare(`
  INSERT INTO tracks (video_id, title, channel, thumbnail, view_count, url, is_target, source_key)
  VALUES (@video_id, @title, @channel, @thumbnail, @view_count, @url, @is_target, @source_key)
  ON CONFLICT(video_id) DO UPDATE SET
    title      = excluded.title,
    channel    = excluded.channel,
    thumbnail  = excluded.thumbnail,
    view_count = excluded.view_count,
    url        = excluded.url,
    is_target  = excluded.is_target,
    source_key = excluded.source_key,
    updated_at = datetime('now')
`);

export function upsertTrack(track: {
  video_id: string;
  title: string;
  channel: string | null;
  thumbnail: string | null;
  view_count: number;
  url: string;
  is_target?: boolean;
  source_key?: string | null;
}): Track {
  insertStmt.run({
    ...track,
    is_target: track.is_target ? 1 : 0,
    source_key: track.source_key ?? null,
  });
  return db
    .prepare("SELECT * FROM tracks WHERE video_id = ?")
    .get(track.video_id) as Track;
}

export function listTracks(): Track[] {
  return db
    .prepare("SELECT * FROM tracks ORDER BY view_count DESC, updated_at DESC")
    .all() as Track[];
}

export function deleteTrack(id: number): void {
  db.prepare("DELETE FROM tracks WHERE id = ?").run(id);
}

/* ── 채널(설정 화면용) ─────────────────────────────── */

const upsertChannelStmt = db.prepare(`
  INSERT INTO channels (key, name, url, is_target)
  VALUES (@key, @name, @url, @is_target)
  ON CONFLICT(key) DO UPDATE SET
    name      = excluded.name,
    url       = excluded.url,
    is_target = MAX(channels.is_target, excluded.is_target)
`);

export function upsertChannel(channel: {
  key: string;
  name: string | null;
  url: string | null;
  is_target?: boolean;
}): void {
  upsertChannelStmt.run({
    ...channel,
    is_target: channel.is_target ? 1 : 0,
  });
}

export function listChannels(): Channel[] {
  return db
    .prepare(
      `SELECT c.*,
              (SELECT COUNT(*) FROM tracks t WHERE t.source_key = c.key) AS track_count
         FROM channels c
     ORDER BY c.is_target DESC, c.created_at ASC`
    )
    .all() as Channel[];
}

/** 채널과 해당 채널의 모든 영상을 함께 삭제 (트랜잭션) */
export const deleteChannelCascade = db.transaction((key: string) => {
  db.prepare("DELETE FROM tracks WHERE source_key = ?").run(key);
  db.prepare("DELETE FROM channels WHERE key = ?").run(key);
});

/** 해당 채널이 (제거 불가한) 대상 채널인지 여부 */
export function isChannelTarget(key: string): boolean {
  const row = db
    .prepare("SELECT is_target FROM channels WHERE key = ?")
    .get(key) as { is_target: number } | undefined;
  return row?.is_target === 1;
}

/**
 * 채널 수집 결과로 기존 데이터를 통째로 교체합니다 (기존 제거 후 재등록).
 * 재수집 시 삭제된 영상이 남지 않도록, 한 트랜잭션에서 delete → insert.
 */
export const replaceChannelData = db.transaction(
  (params: {
    key: string;
    name: string | null;
    url: string | null;
    is_target: boolean;
    tracks: Array<{
      video_id: string;
      title: string;
      channel: string | null;
      thumbnail: string | null;
      view_count: number;
      url: string;
    }>;
  }) => {
    db.prepare("DELETE FROM tracks WHERE source_key = ?").run(params.key);
    for (const t of params.tracks) {
      insertStmt.run({
        ...t,
        is_target: params.is_target ? 1 : 0,
        source_key: params.key,
      });
    }
    upsertChannelStmt.run({
      key: params.key,
      name: params.name,
      url: params.url,
      is_target: params.is_target ? 1 : 0,
    });
  }
);

/* ── meta (키-값) ─────────────────────────────── */

export function getMeta(key: string): string | null {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setMeta(key: string, value: string): void {
  db.prepare(
    "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}
