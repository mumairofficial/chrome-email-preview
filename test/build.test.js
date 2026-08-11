import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFile, access } from 'node:fs/promises';

describe('build', () => {
  beforeAll(() => {
    execFileSync('node', ['build.mjs'], { stdio: 'inherit' });
  }, 60_000);

  it('emits every file the unpacked extension needs', async () => {
    for (const f of [
      'dist/manifest.json',
      'dist/viewer.html',
      'dist/viewer.js',
      'dist/service-worker.js',
      'dist/styles/viewer.css',
    ]) {
      await expect(access(f)).resolves.toBeUndefined();
    }
  });

  it('emits a manifest v3 that points at the built files', async () => {
    const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.background.service_worker).toBe('service-worker.js');
    expect(manifest.background.type).toBe('module');
    expect(manifest.host_permissions).toEqual(['file:///*']);
    expect(manifest.optional_host_permissions).toEqual(['*://*/*']);
    expect(manifest.permissions).toEqual(
      expect.arrayContaining(['webNavigation', 'downloads', 'tabs'])
    );
  });
});
