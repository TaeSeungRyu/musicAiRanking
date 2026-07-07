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

/** 대상(기본) 채널 영상이 이미 저장돼 있는지 여부 */
export function hasTargetTracks(): boolean {
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM tracks WHERE is_target = 1")
    .get() as { n: number };
  return row.n > 0;
}

export function deleteTrack(id: number): void {
  db.prepare("DELETE FROM tracks WHERE id = ?").run(id);
}
