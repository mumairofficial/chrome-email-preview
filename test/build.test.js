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
    // Exact, not arrayContaining: an accidentally widened permission set is a
    // store-review problem, so the test should fail when one is added.
    expect(manifest.permissions).toEqual(['webNavigation', 'downloads']);
  });

  it('emits the icons the manifest declares', async () => {
    const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
    const declared = new Set([
      ...Object.values(manifest.icons),
      ...Object.values(manifest.action.default_icon),
    ]);
    expect(declared.size).toBe(4);
    for (const path of declared) {
      await expect(access(`dist/${path}`)).resolves.toBeUndefined();
    }
  });

  it('ships a viewer that references no stylesheet it does not emit', async () => {
    const html = await readFile('dist/viewer.html', 'utf8');
    for (const href of [...html.matchAll(/<link[^>]+href="\.\/([^"]+)"/g)].map((m) => m[1])) {
      await expect(access(`dist/${href}`)).resolves.toBeUndefined();
    }
  });
});
