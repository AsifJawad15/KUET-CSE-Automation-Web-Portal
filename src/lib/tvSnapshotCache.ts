'use client';

import {
  isTvSnapshotV2,
  type TvSnapshotV2,
} from '../../shared/tv-display/domain';

const DATABASE_NAME = 'kuet-tv-display';
const DATABASE_VERSION = 2;
const SNAPSHOT_STORE = 'snapshots';
const MEDIA_CACHE = 'kuet-tv-media-v2';

interface StoredWebSnapshot {
  target: string;
  savedAt: string;
  snapshot: TvSnapshotV2;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SNAPSHOT_STORE)) {
        database.createObjectStore(SNAPSHOT_STORE, { keyPath: 'target' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open TV cache.'));
  });
}

export async function saveTvSnapshotToWebCache(snapshot: TvSnapshotV2): Promise<void> {
  if (typeof indexedDB === 'undefined' || !isTvSnapshotV2(snapshot)) return;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(SNAPSHOT_STORE, 'readwrite');
    transaction.objectStore(SNAPSHOT_STORE).put({
      target: snapshot.target,
      savedAt: new Date().toISOString(),
      snapshot,
    } satisfies StoredWebSnapshot);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Unable to save TV cache.'));
  });
  database.close();
}

export async function loadTvSnapshotFromWebCache(
  target: string,
): Promise<StoredWebSnapshot | null> {
  if (typeof indexedDB === 'undefined') return null;
  const database = await openDatabase();
  const result = await new Promise<StoredWebSnapshot | null>((resolve, reject) => {
    const transaction = database.transaction(SNAPSHOT_STORE, 'readonly');
    const request = transaction.objectStore(SNAPSHOT_STORE).get(target);
    request.onsuccess = () => resolve((request.result as StoredWebSnapshot | undefined) ?? null);
    request.onerror = () => reject(request.error || new Error('Unable to read TV cache.'));
  });
  database.close();
  return result && isTvSnapshotV2(result.snapshot) ? result : null;
}

export async function prefetchTvSnapshotMedia(snapshot: TvSnapshotV2): Promise<void> {
  if (typeof caches === 'undefined') return;
  const urls = (snapshot.content?.events ?? [])
    .flatMap((value) => {
      const event = value as { image_url?: unknown; speaker_image_url?: unknown };
      return [event.image_url, event.speaker_image_url];
    })
    .filter((value): value is string => typeof value === 'string' && value.startsWith('https://'));
  if (urls.length === 0) return;
  const cache = await caches.open(MEDIA_CACHE);
  await Promise.allSettled(
    [...new Set(urls)].slice(0, 100).map(async (url) => {
      const existing = await cache.match(url);
      if (!existing) {
        const request = new Request(url, { mode: 'no-cors' });
        const response = await fetch(request);
        await cache.put(request, response);
      }
    }),
  );
}
