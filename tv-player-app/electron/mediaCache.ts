import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { app, net, protocol } from 'electron';

interface MediaMeta {
  url: string;
  mimeType: string;
  sizeBytes: number;
  lastAccessedAt: number;
}

const MAX_ASSET_BYTES = 20 * 1024 * 1024;
const DEFAULT_QUOTA_BYTES = 500 * 1024 * 1024;
const ALLOWED_MIME = /^image\/(avif|gif|jpeg|png|svg\+xml|webp)$/i;

function isAllowedUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function toCachedMediaUrl(value: string): string {
  return `tv-media://asset/?url=${encodeURIComponent(value)}`;
}

export class MediaCache {
  private readonly directory: string;
  private readonly quotaBytes: number;
  private retainedHashes = new Set<string>();

  constructor(quotaBytes = DEFAULT_QUOTA_BYTES) {
    this.directory = path.join(app.getPath('userData'), 'media-cache');
    this.quotaBytes = quotaBytes;
  }

  private hash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  private dataPath(hash: string): string {
    return path.join(this.directory, `${hash}.bin`);
  }

  private metaPath(hash: string): string {
    return path.join(this.directory, `${hash}.json`);
  }

  private readMeta(hash: string): MediaMeta | null {
    try {
      return JSON.parse(fs.readFileSync(this.metaPath(hash), 'utf-8')) as MediaMeta;
    } catch {
      return null;
    }
  }

  private readCached(url: string): Response | null {
    const hash = this.hash(url);
    const meta = this.readMeta(hash);
    const dataPath = this.dataPath(hash);
    if (!meta || !fs.existsSync(dataPath)) return null;
    meta.lastAccessedAt = Date.now();
    try {
      fs.writeFileSync(this.metaPath(hash), JSON.stringify(meta), 'utf-8');
    } catch {
      // Cache metadata freshness is best effort.
    }
    return new Response(fs.readFileSync(dataPath), {
      status: 200,
      headers: {
        'Content-Type': meta.mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  }

  private async fetchAndCache(url: string): Promise<Response> {
    const response = await net.fetch(url, { bypassCustomProtocolHandlers: true });
    if (!response.ok) throw new Error(`Media request failed (${response.status}).`);
    const mimeType = response.headers.get('content-type')?.split(';')[0].trim() ?? '';
    if (!ALLOWED_MIME.test(mimeType)) throw new Error('Unsupported media type.');
    const declaredSize = Number(response.headers.get('content-length') ?? 0);
    if (declaredSize > MAX_ASSET_BYTES) throw new Error('Media asset is too large.');

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_ASSET_BYTES) throw new Error('Media asset is too large.');

    fs.mkdirSync(this.directory, { recursive: true });
    const hash = this.hash(url);
    const temporaryPath = `${this.dataPath(hash)}.tmp`;
    fs.writeFileSync(temporaryPath, bytes);
    fs.renameSync(temporaryPath, this.dataPath(hash));
    const meta: MediaMeta = {
      url,
      mimeType,
      sizeBytes: bytes.length,
      lastAccessedAt: Date.now(),
    };
    fs.writeFileSync(this.metaPath(hash), JSON.stringify(meta), 'utf-8');
    this.prune();

    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  }

  registerProtocol(): void {
    protocol.handle('tv-media', async (request) => {
      try {
        const url = new URL(request.url).searchParams.get('url') ?? '';
        if (!isAllowedUrl(url)) return new Response('Invalid media URL.', { status: 400 });
        return this.readCached(url) ?? await this.fetchAndCache(url);
      } catch (error) {
        console.warn('Media cache request failed:', error);
        return new Response('Media unavailable.', { status: 503 });
      }
    });
  }

  async retainAndPrefetch(urls: string[]): Promise<void> {
    const safeUrls = [...new Set(urls.filter(isAllowedUrl))].slice(0, 200);
    this.retainedHashes = new Set(safeUrls.map((url) => this.hash(url)));
    await Promise.allSettled(
      safeUrls.map(async (url) => {
        if (!this.readCached(url)) await this.fetchAndCache(url);
      }),
    );
    this.prune();
  }

  getStats(): { sizeBytes: number; entries: number; quotaBytes: number } {
    if (!fs.existsSync(this.directory)) {
      return { sizeBytes: 0, entries: 0, quotaBytes: this.quotaBytes };
    }
    const metadata = fs.readdirSync(this.directory).filter((name) => name.endsWith('.json'));
    const sizeBytes = metadata.reduce((total, name) => {
      const meta = this.readMeta(name.slice(0, -5));
      return total + (meta?.sizeBytes ?? 0);
    }, 0);
    return { sizeBytes, entries: metadata.length, quotaBytes: this.quotaBytes };
  }

  private prune(): void {
    const stats = this.getStats();
    if (stats.sizeBytes <= this.quotaBytes || !fs.existsSync(this.directory)) return;

    const candidates = fs.readdirSync(this.directory)
      .filter((name) => name.endsWith('.json'))
      .map((name) => {
        const hash = name.slice(0, -5);
        return { hash, meta: this.readMeta(hash) };
      })
      .filter((item): item is { hash: string; meta: MediaMeta } =>
        !!item.meta && !this.retainedHashes.has(item.hash),
      )
      .sort((a, b) => a.meta.lastAccessedAt - b.meta.lastAccessedAt);

    let currentSize = stats.sizeBytes;
    for (const candidate of candidates) {
      if (currentSize <= this.quotaBytes) break;
      for (const filePath of [this.dataPath(candidate.hash), this.metaPath(candidate.hash)]) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          // Already absent or locked; continue pruning other entries.
        }
      }
      currentSize -= candidate.meta.sizeBytes;
    }
  }
}
