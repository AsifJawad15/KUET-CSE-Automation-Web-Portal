import { Worker } from 'node:worker_threads';

export function validateDocxArchive(buffer: Buffer): void {
  if (buffer.length > 2 * 1024 * 1024) throw new Error('File exceeds the 2 MiB limit');
  let total = 0, entries = 0;
  for (let i = 0; i + 46 <= buffer.length; i++) {
    if (buffer.readUInt32LE(i) !== 0x02014b50) continue;
    const expanded = buffer.readUInt32LE(i + 24);
    const compressed = buffer.readUInt32LE(i + 20);
    const flags = buffer.readUInt16LE(i + 8);
    total += expanded; entries++;
    if ((flags & 1) || expanded > 8_388_608 || total > 16_777_216 || entries > 2000 || expanded > Math.max(1, compressed) * 200) {
      throw new Error('Document archive exceeds safe parsing limits');
    }
    i += 45 + buffer.readUInt16LE(i+28) + buffer.readUInt16LE(i+30) + buffer.readUInt16LE(i+32);
  }
  if (!entries) throw new Error('Invalid DOCX archive');
}

export async function extractDocxText(buffer: Buffer): Promise<string> {
  validateDocxArchive(buffer);
  return new Promise((resolve, reject) => {
    const worker = new Worker(`
      const { parentPort, workerData } = require('node:worker_threads');
      require(workerData.module).extractRawText({buffer:Buffer.from(workerData.bytes)})
        .then(r=>parentPort.postMessage(r.value)).catch(()=>process.exit(1));
    `, { eval: true, workerData: { bytes: buffer, module: require.resolve('mammoth') }, resourceLimits: { maxOldGenerationSizeMb: 64 } });
    const timer = setTimeout(() => { void worker.terminate(); reject(new Error('Document parsing timed out')); }, 10000);
    worker.once('message', (text: string) => {
      clearTimeout(timer); void worker.terminate();
      if (text.length > 2_000_000 || text.split('\n').length > 10000) reject(new Error('Document text exceeds limits'));
      else resolve(text);
    });
    worker.once('error', () => { clearTimeout(timer); reject(new Error('Document parsing failed')); });
    worker.once('exit', code => { clearTimeout(timer); if (code !== 0) reject(new Error('Document parsing stopped')); });
  });
}

export async function boundedFormData(request: Request): Promise<FormData> {
  const chunks: Uint8Array[] = []; let size = 0;
  const reader = request.body?.getReader();
  if (!reader) throw new Error('No upload body');
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.length;
    if (size > 2_500_000) { await reader.cancel(); throw new Error('Upload exceeds size limit'); }
    chunks.push(value);
  }
  return new Response(Buffer.concat(chunks), { headers: { 'content-type': request.headers.get('content-type') ?? '' } }).formData();
}
