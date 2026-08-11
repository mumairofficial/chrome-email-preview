// Produces a Chrome Web Store upload artifact: release/eml-preview-<version>.zip
//
// The Web Store takes a plain zip of the extension directory, NOT a .crx.
// A .crx is only for self-hosting, which Chrome blocks on macOS and Windows
// unless the extension is installed by enterprise policy. See README.
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, access } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const dist = resolve(root, 'dist');
const releases = resolve(root, 'release');

try {
  await access(dist);
} catch {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}

const { name, version } = JSON.parse(await readFile(resolve(dist, 'manifest.json'), 'utf8'));
const slug = name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const zipPath = resolve(releases, `${slug}-${version}.zip`);

await mkdir(releases, { recursive: true });
await rm(zipPath, { force: true });

// Zip the contents of dist/, not dist/ itself — the Web Store expects
// manifest.json at the archive root.
execFileSync('zip', ['-r', '-q', '-X', zipPath, '.', '-x', '.DS_Store', '-x', '__MACOSX/*'], {
  cwd: dist,
  stdio: 'inherit',
});

console.log(`Packaged ${slug} v${version} → release/${slug}-${version}.zip`);
