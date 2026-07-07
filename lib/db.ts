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
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
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
  created_at: string;
  updated_at: string;
}

const insertStmt = db.prepare(`
  INSERT INTO tracks (video_id, title, channel, thumbnail, view_count, url)
  VALUES (@video_id, @title, @channel, @thumbnail, @view_count, @url)
  ON CONFLICT(video_id) DO UPDATE SET
    title      = excluded.title,
    channel    = excluded.channel,
    thumbnail  = excluded.thumbnail,
    view_count = excluded.view_count,
    url        = excluded.url,
    updated_at = datetime('now')
`);

export function upsertTrack(track: {
  video_id: string;
  title: string;
  channel: string | null;
  thumbnail: string | null;
  view_count: number;
  url: string;
}): Track {
  insertStmt.run(track);
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
