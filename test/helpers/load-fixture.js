import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// The jsdom test environment rewrites import.meta.url to an http URL, so paths
// are resolved from the project root (vitest's cwd) instead.
export async function loadFixture(name) {
  const buf = await readFile(resolve(process.cwd(), 'test/fixtures', name));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}
