# EML Preview Chrome Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome MV3 extension that renders `.eml` email files locally in the browser, with HTML multipart fidelity, inline `cid:` images, and remote content blocked by default.

**Architecture:** Chrome never renders `message/rfc822` as a page, so a service worker intercepts `.eml` navigations and downloads and redirects them into a single extension page, `viewer.html`, which is the whole application. Bytes flow through a chain of pure transforms — parse → inline cid → sanitize → block remote → wrap in CSP'd srcdoc — and land in an opaque-origin sandboxed iframe.

**Tech Stack:** Chrome Manifest V3, vanilla ES modules, [postal-mime](https://github.com/postalsys/postal-mime) (MIME parsing), [DOMPurify](https://github.com/cure53/DOMPurify) (sanitization), esbuild (bundling), Vitest + jsdom (tests).

**Spec:** `docs/superpowers/specs/2026-08-10-eml-preview-design.md`

## Global Constraints

- Node 22+, npm 10+. ES modules everywhere (`"type": "module"` in package.json).
- Runtime dependencies are exactly two: `postal-mime` and `dompurify`. Do not add more.
- Every module under `src/lib/` must be free of `chrome.*` API calls so it is testable in jsdom. Chrome APIs live only in `src/background/` and `src/viewer/`.
- Anything non-deterministic (nonce generation, blob URL creation, `fetch`) is passed in as a parameter with a default, so tests can inject a fake.
- The rendering iframe MUST NOT have `allow-same-origin` in its sandbox attribute. This is the security boundary; nothing may weaken it.
- Test command is `npm test`. Build command is `npm run build`. The loadable extension is `dist/`, which is gitignored.
- Commit after every task using the `feat:`/`test:`/`chore:` prefix shown in that task's commit step.

---

### Task 1: Project scaffold and build pipeline

**Files:**
- Create: `package.json`, `build.mjs`, `vitest.config.js`, `.gitignore`
- Create: `src/manifest.json`, `src/viewer/viewer.html`, `src/viewer/viewer.js`, `src/background/service-worker.js`, `src/styles/viewer.css`
- Test: `test/build.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: a working `npm run build` that emits `dist/manifest.json`, `dist/viewer.html`, `dist/viewer.js`, `dist/service-worker.js`, `dist/styles/viewer.css`; and a working `npm test`.

- [ ] **Step 1: Initialize the package**

```bash
cd /Users/muhammadu/Documents/workspace/poc/chrome-eml-preview
npm init -y
npm pkg set type=module
npm pkg set scripts.build="node build.mjs"
npm pkg set scripts.watch="node build.mjs --watch"
npm pkg set scripts.test="vitest run"
npm pkg delete scripts.test --workspaces=false 2>/dev/null; npm pkg set scripts.test="vitest run"
npm install postal-mime dompurify
npm install -D esbuild vitest jsdom
```

- [ ] **Step 2: Write `.gitignore`**

```
node_modules/
dist/
```

- [ ] **Step 3: Write the failing test**

Create `test/build.test.js`:

```js
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
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `build.mjs` does not exist.

- [ ] **Step 5: Write `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.js'],
  },
});
```

- [ ] **Step 6: Write `build.mjs`**

```js
import * as esbuild from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';

const watch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: {
    'service-worker': 'src/background/service-worker.js',
    viewer: 'src/viewer/viewer.js',
  },
  bundle: true,
  format: 'esm',
  target: 'chrome120',
  outdir: 'dist',
  logLevel: 'info',
};

async function copyStatic() {
  await cp('src/manifest.json', 'dist/manifest.json');
  await cp('src/viewer/viewer.html', 'dist/viewer.html');
  await cp('src/styles', 'dist/styles', { recursive: true });
}

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });

if (watch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  await copyStatic();
  console.log('watching...');
} else {
  await esbuild.build(buildOptions);
  await copyStatic();
}
```

- [ ] **Step 7: Write `src/manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "EML Preview",
  "version": "0.1.0",
  "description": "Preview .eml email files directly in Chrome, without uploading them anywhere.",
  "permissions": ["webNavigation", "downloads", "tabs"],
  "host_permissions": ["file:///*"],
  "optional_host_permissions": ["*://*/*"],
  "background": {
    "service_worker": "service-worker.js",
    "type": "module"
  },
  "action": {
    "default_title": "Open EML viewer"
  }
}
```

- [ ] **Step 8: Write the placeholder entry points**

`src/viewer/viewer.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>EML Preview</title>
    <link rel="stylesheet" href="./styles/viewer.css" />
  </head>
  <body>
    <main id="app"></main>
    <script type="module" src="./viewer.js"></script>
  </body>
</html>
```

`src/viewer/viewer.js`:

```js
// Orchestration is filled in by Task 9.
```

`src/background/service-worker.js`:

```js
// Interception is filled in by Task 8.
```

`src/styles/viewer.css`:

```css
:root {
  color-scheme: light dark;
  --bg: Canvas;
  --fg: CanvasText;
  --muted: color-mix(in srgb, CanvasText 55%, Canvas);
  --line: color-mix(in srgb, CanvasText 15%, Canvas);
  --accent: #2563eb;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
}

#app {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px 16px 64px;
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — both `build` tests green.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold MV3 extension with esbuild build and vitest"
```

---

### Task 2: Email fixtures and the MIME parser

**Files:**
- Create: `test/fixtures/*.eml` (11 files)
- Create: `test/helpers/load-fixture.js`
- Create: `src/lib/parse-email.js`
- Test: `test/parse-email.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `parseEmail(buffer: ArrayBuffer | Uint8Array): Promise<EmailModel>`
  - `normalizeCid(cid: string): string` — strips surrounding angle brackets
  - `class EmailParseError extends Error`
  - `EmailModel` shape: `{ headers: {key,value}[], from: {name,address}|null, to: [], cc: [], bcc: [], replyTo: [], subject: string, messageId: string, inReplyTo: string, references: string, date: string, html: string|null, text: string|null, attachments: Attachment[] }`
  - `Attachment` shape: `{ filename: string, mimeType: string, disposition: string, related: boolean, contentId: string, content: ArrayBuffer, size: number }`
  - `loadFixture(name: string): Promise<ArrayBuffer>` from the test helper

- [ ] **Step 1: Write the fixture files**

Create each file under `test/fixtures/`. These are literal RFC 822 bytes — preserve the blank line between headers and body exactly.

`plain-text.eml`:

```
From: Alice <alice@example.com>
To: Bob <bob@example.com>
Subject: Plain text hello
Date: Mon, 10 Aug 2026 09:00:00 +0000
Message-ID: <plain-1@example.com>
Content-Type: text/plain; charset=utf-8

Hello Bob.
This is plain text.
```

`html-only.eml`:

```
From: Alice <alice@example.com>
To: Bob <bob@example.com>
Subject: HTML only
Date: Mon, 10 Aug 2026 09:01:00 +0000
Content-Type: text/html; charset=utf-8

<html><body><h1>Heading</h1><p>Hello <b>Bob</b>.</p></body></html>
```

`multipart-alternative.eml`:

```
From: Alice <alice@example.com>
To: Bob <bob@example.com>
Subject: Alternative parts
Date: Mon, 10 Aug 2026 09:02:00 +0000
MIME-Version: 1.0
Content-Type: multipart/alternative; boundary="ALT"

--ALT
Content-Type: text/plain; charset=utf-8

Plain version.
--ALT
Content-Type: text/html; charset=utf-8

<p>HTML version.</p>
--ALT--
```

`multipart-related-cid.eml`:

```
From: Alice <alice@example.com>
To: Bob <bob@example.com>
Subject: Inline image
Date: Mon, 10 Aug 2026 09:03:00 +0000
MIME-Version: 1.0
Content-Type: multipart/related; boundary="REL"

--REL
Content-Type: text/html; charset=utf-8

<p>Logo: <img src="cid:logo@example.com" alt="logo"></p>
--REL
Content-Type: image/gif
Content-Transfer-Encoding: base64
Content-ID: <logo@example.com>
Content-Disposition: inline; filename="logo.gif"

R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7
--REL--
```

`with-attachment.eml`:

```
From: Alice <alice@example.com>
To: Bob <bob@example.com>
Subject: Here is the report
Date: Mon, 10 Aug 2026 09:04:00 +0000
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="MIX"

--MIX
Content-Type: text/plain; charset=utf-8

Report attached.
--MIX
Content-Type: text/plain; charset=utf-8; name="report.txt"
Content-Transfer-Encoding: base64
Content-Disposition: attachment; filename="report.txt"

aGVsbG8gcmVwb3J0
--MIX--
```

`nested-rfc822.eml`:

```
From: Alice <alice@example.com>
To: Bob <bob@example.com>
Subject: Fwd: original message
Date: Mon, 10 Aug 2026 09:05:00 +0000
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="FWD"

--FWD
Content-Type: text/plain; charset=utf-8

See forwarded message.
--FWD
Content-Type: message/rfc822
Content-Disposition: attachment; filename="original.eml"

From: Carol <carol@example.com>
To: Alice <alice@example.com>
Subject: Original subject
Date: Sun, 09 Aug 2026 12:00:00 +0000
Content-Type: text/plain; charset=utf-8

Original body.
--FWD--
```

`quoted-printable-latin1.eml`:

```
From: Alice <alice@example.com>
To: Bob <bob@example.com>
Subject: Latin-1 body
Date: Mon, 10 Aug 2026 09:06:00 +0000
Content-Type: text/plain; charset=iso-8859-1
Content-Transfer-Encoding: quoted-printable

Caf=E9 au lait
```

`base64-shiftjis.eml`:

```
From: Alice <alice@example.com>
To: Bob <bob@example.com>
Subject: Shift_JIS body
Date: Mon, 10 Aug 2026 09:07:00 +0000
Content-Type: text/plain; charset=shift_jis
Content-Transfer-Encoding: base64

g2WDWINn
```

`encoded-word.eml`:

```
From: =?UTF-8?Q?Jos=C3=A9_Garc=C3=ADa?= <jose@example.com>
To: Bob <bob@example.com>
Subject: =?UTF-8?Q?Subject_with_=E2=9C=93?=
Date: Mon, 10 Aug 2026 09:08:00 +0000
Content-Type: text/plain; charset=utf-8

Body.
```

`hostile.eml`:

```
From: Mallory <mallory@example.com>
To: Bob <bob@example.com>
Subject: Please read
Date: Mon, 10 Aug 2026 09:09:00 +0000
Content-Type: text/html; charset=utf-8

<html><head><style>body { color: #333; }</style></head><body>
<script>window.stolen = document.cookie;</script>
<img src="https://tracker.example.com/pixel.gif" width="1" height="1">
<img src="broken.png" onerror="alert(1)">
<a href="javascript:alert(2)">click me</a>
<iframe src="https://evil.example.com/"></iframe>
<div style="position: fixed; top: 0">overlay</div>
<p>Visible text.</p>
</body></html>
```

`truncated.eml`:

```
From: Alice <alice@example.com>
To: Bob <bob@example.com>
Subject: Truncated message
Date: Mon, 10 Aug 2026 09:10:00 +0000
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="CUT"

--CUT
Content-Type: text/plain; charset=utf-8

This message stops mid-
```

- [ ] **Step 2: Write the fixture loader helper**

Create `test/helpers/load-fixture.js`:

```js
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export async function loadFixture(name) {
  const path = fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
  const buf = await readFile(path);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}
```

- [ ] **Step 3: Write the failing test**

Create `test/parse-email.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { parseEmail, normalizeCid, EmailParseError } from '../src/lib/parse-email.js';
import { loadFixture } from './helpers/load-fixture.js';

const parse = async (name) => parseEmail(await loadFixture(name));

describe('parseEmail', () => {
  it('reads headers and a plain text body', async () => {
    const m = await parse('plain-text.eml');
    expect(m.subject).toBe('Plain text hello');
    expect(m.from).toEqual({ name: 'Alice', address: 'alice@example.com' });
    expect(m.to[0].address).toBe('bob@example.com');
    expect(m.text).toContain('Hello Bob.');
    expect(m.html).toBeNull();
    expect(m.headers.some((h) => h.key.toLowerCase() === 'message-id')).toBe(true);
  });

  it('reads an html-only body', async () => {
    const m = await parse('html-only.eml');
    expect(m.html).toContain('<h1>Heading</h1>');
  });

  it('exposes both parts of multipart/alternative', async () => {
    const m = await parse('multipart-alternative.eml');
    expect(m.text).toContain('Plain version.');
    expect(m.html).toContain('HTML version.');
  });

  it('marks cid images as related inline attachments', async () => {
    const m = await parse('multipart-related-cid.eml');
    expect(m.attachments).toHaveLength(1);
    const [img] = m.attachments;
    expect(img.contentId).toBe('logo@example.com');
    expect(img.mimeType).toBe('image/gif');
    expect(img.disposition).toBe('inline');
    expect(img.size).toBeGreaterThan(0);
  });

  it('exposes regular attachments with size', async () => {
    const m = await parse('with-attachment.eml');
    const att = m.attachments.find((a) => a.filename === 'report.txt');
    expect(att).toBeDefined();
    expect(att.size).toBe(12);
    expect(new TextDecoder().decode(att.content)).toBe('hello report');
  });

  it('exposes a nested rfc822 attachment', async () => {
    const m = await parse('nested-rfc822.eml');
    const nested = m.attachments.find((a) => a.mimeType === 'message/rfc822');
    expect(nested).toBeDefined();
    const inner = await parseEmail(nested.content);
    expect(inner.subject).toBe('Original subject');
  });

  it('decodes quoted-printable iso-8859-1', async () => {
    const m = await parse('quoted-printable-latin1.eml');
    expect(m.text).toContain('Café au lait');
  });

  it('decodes base64 shift_jis', async () => {
    const m = await parse('base64-shiftjis.eml');
    expect(m.text).toContain('テスト');
  });

  it('decodes RFC 2047 encoded words in subject and display name', async () => {
    const m = await parse('encoded-word.eml');
    expect(m.subject).toBe('Subject with ✓');
    expect(m.from.name).toBe('José García');
  });

  it('renders what it can from a truncated message', async () => {
    const m = await parse('truncated.eml');
    expect(m.subject).toBe('Truncated message');
    expect(m.text).toContain('This message stops mid-');
  });

  it('throws EmailParseError on bytes that are not a message', async () => {
    const bytes = new TextEncoder().encode('not an email at all').buffer;
    await expect(parseEmail(bytes)).rejects.toBeInstanceOf(EmailParseError);
  });
});

describe('normalizeCid', () => {
  it('strips angle brackets', () => {
    expect(normalizeCid('<logo@example.com>')).toBe('logo@example.com');
  });

  it('passes through bare ids and empty values', () => {
    expect(normalizeCid('logo@example.com')).toBe('logo@example.com');
    expect(normalizeCid(undefined)).toBe('');
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run test/parse-email.test.js`
Expected: FAIL — cannot resolve `../src/lib/parse-email.js`.

- [ ] **Step 5: Write `src/lib/parse-email.js`**

```js
import PostalMime from 'postal-mime';

export class EmailParseError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'EmailParseError';
  }
}

export function normalizeCid(cid) {
  if (!cid) return '';
  return String(cid).replace(/^</, '').replace(/>$/, '');
}

function toAttachment(raw) {
  const content = raw.content instanceof ArrayBuffer
    ? raw.content
    : new Uint8Array(raw.content ?? []).buffer;
  return {
    filename: raw.filename || '(unnamed)',
    mimeType: raw.mimeType || 'application/octet-stream',
    disposition: raw.disposition || 'attachment',
    related: Boolean(raw.related) || raw.disposition === 'inline',
    contentId: normalizeCid(raw.contentId),
    content,
    size: content.byteLength,
  };
}

export async function parseEmail(buffer) {
  let raw;
  try {
    raw = await new PostalMime().parse(buffer);
  } catch (cause) {
    throw new EmailParseError('Could not parse this file as an email message.', { cause });
  }

  const model = {
    headers: (raw.headers ?? []).map((h) => ({ key: h.key, value: h.value })),
    from: raw.from ?? null,
    to: raw.to ?? [],
    cc: raw.cc ?? [],
    bcc: raw.bcc ?? [],
    replyTo: raw.replyTo ?? [],
    subject: raw.subject ?? '',
    messageId: raw.messageId ?? '',
    inReplyTo: raw.inReplyTo ?? '',
    references: raw.references ?? '',
    date: raw.date ?? '',
    html: raw.html || null,
    text: raw.text || null,
    attachments: (raw.attachments ?? []).map(toAttachment),
  };

  const empty = model.headers.length === 0 && !model.html && !model.text;
  if (empty) {
    throw new EmailParseError('Could not parse this file as an email message.');
  }
  return model;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run test/parse-email.test.js`
Expected: PASS — all 12 tests green.

If `normalizeCid` or the `related` flag assertions fail, inspect the real postal-mime output with:
`node -e "import('postal-mime').then(async m => console.dir(await new m.default().parse(require('fs').readFileSync('test/fixtures/multipart-related-cid.eml')), {depth:4}))"`
and adjust the mapping in `toAttachment` — do not adjust the test expectations, which encode the interface later tasks depend on.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: parse .eml bytes into a normalized EmailModel"
```

---

### Task 3: HTML sanitization

**Files:**
- Create: `src/lib/sanitize-html.js`
- Test: `test/sanitize-html.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `sanitizeHtml(html: string | null): string` — returns a body-level HTML fragment with `<style>` blocks from `<head>` hoisted into it. Returns `''` for falsy input.

- [ ] **Step 1: Write the failing test**

Create `test/sanitize-html.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../src/lib/sanitize-html.js';
import { parseEmail } from '../src/lib/parse-email.js';
import { loadFixture } from './helpers/load-fixture.js';

const frag = (html) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body;
};

describe('sanitizeHtml', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeHtml(null)).toBe('');
    expect(sanitizeHtml('')).toBe('');
  });

  it('keeps ordinary content and inline styles', () => {
    const out = sanitizeHtml('<p style="color:red">hi <b>there</b></p>');
    expect(out).toContain('<b>there</b>');
    expect(out).toContain('color:red');
  });

  it('hoists head style blocks into the fragment', () => {
    const out = sanitizeHtml('<html><head><style>p{color:blue}</style></head><body><p>x</p></body></html>');
    expect(out).toContain('p{color:blue}');
    expect(out).toContain('<p>x</p>');
  });

  it('strips every executable vector from the hostile fixture', async () => {
    const model = await parseEmail(await loadFixture('hostile.eml'));
    const body = frag(sanitizeHtml(model.html));

    expect(body.querySelectorAll('script')).toHaveLength(0);
    expect(body.querySelectorAll('iframe')).toHaveLength(0);
    expect(body.innerHTML).not.toContain('onerror');
    expect(body.innerHTML).not.toContain('javascript:');
    expect(body.textContent).toContain('Visible text.');
  });

  it('removes position fixed and sticky', async () => {
    const model = await parseEmail(await loadFixture('hostile.eml'));
    const out = sanitizeHtml(model.html);
    expect(out).not.toMatch(/position\s*:\s*fixed/i);
    expect(sanitizeHtml('<div style="position:sticky;color:red">x</div>')).not.toMatch(/sticky/i);
  });

  it('drops meta, link and base so the email cannot override our CSP or load remote css', () => {
    const out = sanitizeHtml(
      '<html><head><meta http-equiv="Content-Security-Policy" content="default-src *">' +
      '<link rel="stylesheet" href="https://evil.example.com/a.css"><base href="https://evil.example.com/">' +
      '</head><body><p>x</p></body></html>'
    );
    expect(out).not.toContain('<meta');
    expect(out).not.toContain('<link');
    expect(out).not.toContain('<base');
  });

  it('preserves cid, https and mailto urls', () => {
    const out = sanitizeHtml(
      '<img src="cid:a@b"><a href="https://ok.example.com/x">a</a><a href="mailto:x@y.z">b</a>'
    );
    expect(out).toContain('cid:a@b');
    expect(out).toContain('https://ok.example.com/x');
    expect(out).toContain('mailto:x@y.z');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/sanitize-html.test.js`
Expected: FAIL — cannot resolve `../src/lib/sanitize-html.js`.

- [ ] **Step 3: Write `src/lib/sanitize-html.js`**

```js
import DOMPurify from 'dompurify';

// Email layout depends on inline and embedded CSS, so <style> and style="" stay.
// Everything that can execute, navigate, or reach the network on its own goes.
const FORBID_TAGS = ['script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'form', 'base', 'meta', 'link'];
const FORBID_ATTR = ['srcset', 'ping', 'formaction', 'target'];

// Relative URLs are meaningless in an email opened from a file, so only known
// schemes survive. Anchors are kept so in-message jump links still work.
const ALLOWED_URI_REGEXP = /^(?:https?:|mailto:|tel:|cid:|blob:|#|data:image\/)/i;

export function sanitizeHtml(html) {
  if (!html) return '';

  const clean = DOMPurify.sanitize(html, {
    WHOLE_DOCUMENT: true,
    FORBID_TAGS,
    FORBID_ATTR,
    ALLOWED_URI_REGEXP,
  });

  const doc = new DOMParser().parseFromString(clean, 'text/html');
  stripPinnedPositioning(doc);

  // <style> from <head> is hoisted into the fragment; browsers apply it wherever
  // it appears, and the fragment is what gets wrapped into the iframe srcdoc.
  return doc.head.innerHTML + doc.body.innerHTML;
}

function stripPinnedPositioning(doc) {
  for (const el of doc.querySelectorAll('[style]')) {
    const next = el.getAttribute('style').replace(/position\s*:\s*(fixed|sticky)\s*;?/gi, '');
    el.setAttribute('style', next);
  }
  for (const style of doc.querySelectorAll('style')) {
    style.textContent = style.textContent.replace(/position\s*:\s*(fixed|sticky)\s*;?/gi, '');
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/sanitize-html.test.js`
Expected: PASS — 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: sanitize email html with DOMPurify"
```

---

### Task 4: Remote content blocking

**Files:**
- Create: `src/lib/block-remote.js`
- Test: `test/block-remote.test.js`

**Interfaces:**
- Consumes: `sanitizeHtml` output (a body-level fragment).
- Produces: `blockRemote(html: string): { html: string, blockedCount: number }`. Blocked `<img>` keeps its original URL in `data-blocked-src` and loses `src`. Unblocking is done by re-running the pipeline without this step, not by reversing it.

- [ ] **Step 1: Write the failing test**

Create `test/block-remote.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { blockRemote } from '../src/lib/block-remote.js';
import { sanitizeHtml } from '../src/lib/sanitize-html.js';
import { parseEmail } from '../src/lib/parse-email.js';
import { loadFixture } from './helpers/load-fixture.js';

describe('blockRemote', () => {
  it('strips remote image src and records it', () => {
    const { html, blockedCount } = blockRemote('<img src="https://t.example.com/p.gif">');
    expect(blockedCount).toBe(1);
    expect(html).not.toContain('src="https://t.example.com/p.gif"');
    expect(html).toContain('data-blocked-src="https://t.example.com/p.gif"');
  });

  it('blocks protocol-relative and plain http images', () => {
    expect(blockRemote('<img src="//t.example.com/p.gif">').blockedCount).toBe(1);
    expect(blockRemote('<img src="http://t.example.com/p.gif">').blockedCount).toBe(1);
  });

  it('leaves cid, data and blob images alone', () => {
    const src = '<img src="cid:a@b"><img src="data:image/gif;base64,AA"><img src="blob:x">';
    const { html, blockedCount } = blockRemote(src);
    expect(blockedCount).toBe(0);
    expect(html).toContain('cid:a@b');
    expect(html).toContain('blob:x');
  });

  it('strips remote url() from inline styles and style blocks', () => {
    const inline = blockRemote('<div style="background: url(https://t.example.com/b.png) no-repeat">x</div>');
    expect(inline.blockedCount).toBe(1);
    expect(inline.html).not.toContain('t.example.com');

    const block = blockRemote('<style>.a{background-image:url("https://t.example.com/c.png")}</style>');
    expect(block.blockedCount).toBe(1);
    expect(block.html).not.toContain('t.example.com');
  });

  it('strips the legacy background attribute', () => {
    const { html, blockedCount } = blockRemote('<td background="https://t.example.com/d.png">x</td>');
    expect(blockedCount).toBe(1);
    expect(html).not.toContain('t.example.com');
  });

  it('reports exactly one blocked resource for the hostile fixture', async () => {
    const model = await parseEmail(await loadFixture('hostile.eml'));
    const { blockedCount } = blockRemote(sanitizeHtml(model.html));
    expect(blockedCount).toBe(1);
  });

  it('leaves link hrefs intact — only fetched subresources are blocked', () => {
    const { html, blockedCount } = blockRemote('<a href="https://ok.example.com/x">a</a>');
    expect(blockedCount).toBe(0);
    expect(html).toContain('https://ok.example.com/x');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/block-remote.test.js`
Expected: FAIL — cannot resolve `../src/lib/block-remote.js`.

- [ ] **Step 3: Write `src/lib/block-remote.js`**

```js
const REMOTE_URL = /^(?:https?:)?\/\//i;
const REMOTE_CSS_URL = /url\(\s*(['"]?)(?:https?:)?\/\/[^)'"]*\1\s*\)/gi;

export function blockRemote(html) {
  if (!html) return { html: '', blockedCount: 0 };

  const doc = new DOMParser().parseFromString(html, 'text/html');
  let blockedCount = 0;

  for (const img of doc.querySelectorAll('img[src]')) {
    const src = img.getAttribute('src');
    if (!REMOTE_URL.test(src)) continue;
    img.setAttribute('data-blocked-src', src);
    img.removeAttribute('src');
    blockedCount += 1;
  }

  for (const el of doc.querySelectorAll('[background]')) {
    const src = el.getAttribute('background');
    if (!REMOTE_URL.test(src)) continue;
    el.setAttribute('data-blocked-background', src);
    el.removeAttribute('background');
    blockedCount += 1;
  }

  for (const el of doc.querySelectorAll('[style]')) {
    const before = el.getAttribute('style');
    const after = before.replace(REMOTE_CSS_URL, 'none');
    if (after === before) continue;
    el.setAttribute('style', after);
    blockedCount += countMatches(before);
  }

  for (const style of doc.querySelectorAll('style')) {
    const before = style.textContent;
    const after = before.replace(REMOTE_CSS_URL, 'none');
    if (after === before) continue;
    style.textContent = after;
    blockedCount += countMatches(before);
  }

  return { html: doc.head.innerHTML + doc.body.innerHTML, blockedCount };
}

function countMatches(text) {
  return (text.match(REMOTE_CSS_URL) ?? []).length;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/block-remote.test.js`
Expected: PASS — 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: block remote images and css urls by default"
```

---

### Task 5: Inline cid resolution

**Files:**
- Create: `src/lib/inline-cid.js`
- Test: `test/inline-cid.test.js`

**Interfaces:**
- Consumes: `Attachment[]` from Task 2.
- Produces:
  - `buildCidMap(attachments: Attachment[], createUrl?: (blob: Blob) => string): Map<string, string>` — `createUrl` defaults to `URL.createObjectURL` and is injected in tests because jsdom does not implement it.
  - `inlineCid(html: string, cidMap: Map<string, string>): string` — rewrites `src="cid:X"` to the mapped URL; leaves unmatched `cid:` references untouched.

- [ ] **Step 1: Write the failing test**

Create `test/inline-cid.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { buildCidMap, inlineCid } from '../src/lib/inline-cid.js';
import { parseEmail } from '../src/lib/parse-email.js';
import { loadFixture } from './helpers/load-fixture.js';

let counter = 0;
const fakeCreateUrl = () => `blob:fake/${counter++}`;

describe('buildCidMap', () => {
  it('maps content ids to created urls', async () => {
    counter = 0;
    const model = await parseEmail(await loadFixture('multipart-related-cid.eml'));
    const map = buildCidMap(model.attachments, fakeCreateUrl);
    expect(map.get('logo@example.com')).toBe('blob:fake/0');
  });

  it('ignores attachments without a content id', () => {
    const map = buildCidMap(
      [{ contentId: '', mimeType: 'text/plain', content: new ArrayBuffer(1) }],
      fakeCreateUrl
    );
    expect(map.size).toBe(0);
  });
});

describe('inlineCid', () => {
  it('rewrites cid references to mapped urls', () => {
    const map = new Map([['logo@example.com', 'blob:fake/9']]);
    const out = inlineCid('<img src="cid:logo@example.com" alt="logo">', map);
    expect(out).toContain('src="blob:fake/9"');
    expect(out).not.toContain('cid:');
  });

  it('accepts cid references wrapped in angle brackets', () => {
    const map = new Map([['logo@example.com', 'blob:fake/9']]);
    expect(inlineCid('<img src="cid:<logo@example.com>">', map)).toContain('blob:fake/9');
  });

  it('leaves unmatched cid references alone', () => {
    const out = inlineCid('<img src="cid:missing@example.com">', new Map());
    expect(out).toContain('cid:missing@example.com');
  });

  it('resolves the related fixture end to end', async () => {
    counter = 0;
    const model = await parseEmail(await loadFixture('multipart-related-cid.eml'));
    const map = buildCidMap(model.attachments, fakeCreateUrl);
    expect(inlineCid(model.html, map)).toContain('src="blob:fake/0"');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/inline-cid.test.js`
Expected: FAIL — cannot resolve `../src/lib/inline-cid.js`.

- [ ] **Step 3: Write `src/lib/inline-cid.js`**

```js
const defaultCreateUrl = (blob) => URL.createObjectURL(blob);

export function buildCidMap(attachments = [], createUrl = defaultCreateUrl) {
  const map = new Map();
  for (const att of attachments) {
    if (!att.contentId) continue;
    const blob = new Blob([att.content], { type: att.mimeType });
    map.set(att.contentId, createUrl(blob));
  }
  return map;
}

export function inlineCid(html, cidMap) {
  if (!html) return '';
  if (!cidMap || cidMap.size === 0) return html;

  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const el of doc.querySelectorAll('[src^="cid:" i]')) {
    const id = el.getAttribute('src').slice(4).replace(/^</, '').replace(/>$/, '');
    const url = cidMap.get(id);
    if (url) el.setAttribute('src', url);
  }
  return doc.head.innerHTML + doc.body.innerHTML;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/inline-cid.test.js`
Expected: PASS — 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: resolve cid references to blob urls"
```

---

### Task 6: Sandboxed srcdoc builder

**Files:**
- Create: `src/lib/build-srcdoc.js`
- Test: `test/build-srcdoc.test.js`

**Interfaces:**
- Consumes: the fragment produced by the transform chain.
- Produces:
  - `buildSrcdoc(bodyHtml: string, { nonce: string, allowRemoteImages?: boolean }): string`
  - `IFRAME_SANDBOX: string` — the exact sandbox attribute value the viewer must use.
  - `HEIGHT_MESSAGE_TYPE: string` — the `postMessage` discriminator (`'eml-preview-height'`).

- [ ] **Step 1: Write the failing test**

Create `test/build-srcdoc.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { buildSrcdoc, IFRAME_SANDBOX, HEIGHT_MESSAGE_TYPE } from '../src/lib/build-srcdoc.js';

const cspOf = (doc) =>
  doc.querySelector('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');

const parse = (html) => new DOMParser().parseFromString(html, 'text/html');

describe('IFRAME_SANDBOX', () => {
  it('never grants same-origin — this is the security boundary', () => {
    expect(IFRAME_SANDBOX).not.toContain('allow-same-origin');
  });

  it('grants only scripts and escaping popups', () => {
    expect(IFRAME_SANDBOX.split(/\s+/).sort()).toEqual([
      'allow-popups',
      'allow-popups-to-escape-sandbox',
      'allow-scripts',
    ]);
  });
});

describe('buildSrcdoc', () => {
  it('blocks remote images in the default policy', () => {
    const csp = cspOf(parse(buildSrcdoc('<p>x</p>', { nonce: 'N1' })));
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain('img-src data: blob:');
    expect(csp).not.toContain('https:');
  });

  it('allows remote images only when asked', () => {
    const csp = cspOf(parse(buildSrcdoc('<p>x</p>', { nonce: 'N1', allowRemoteImages: true })));
    expect(csp).toContain('img-src data: blob: https: http:');
  });

  it('permits scripts only via the given nonce', () => {
    const csp = cspOf(parse(buildSrcdoc('<p>x</p>', { nonce: 'N1' })));
    expect(csp).toContain("script-src 'nonce-N1'");
    expect(csp).not.toContain('unsafe-inline\'; script');
  });

  it('embeds exactly one script and it carries the nonce', () => {
    const doc = parse(buildSrcdoc('<p>x</p>', { nonce: 'N1' }));
    const scripts = doc.querySelectorAll('script');
    expect(scripts).toHaveLength(1);
    expect(scripts[0].getAttribute('nonce')).toBe('N1');
    expect(scripts[0].textContent).toContain(HEIGHT_MESSAGE_TYPE);
  });

  it('opens links in a new tab by default', () => {
    const doc = parse(buildSrcdoc('<p>x</p>', { nonce: 'N1' }));
    expect(doc.querySelector('base').getAttribute('target')).toBe('_blank');
  });

  it('includes the message body', () => {
    expect(buildSrcdoc('<p>hello</p>', { nonce: 'N1' })).toContain('<p>hello</p>');
  });

  it('rejects a missing nonce rather than emitting an unguarded policy', () => {
    expect(() => buildSrcdoc('<p>x</p>', {})).toThrow(/nonce/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/build-srcdoc.test.js`
Expected: FAIL — cannot resolve `../src/lib/build-srcdoc.js`.

- [ ] **Step 3: Write `src/lib/build-srcdoc.js`**

```js
// WHY THIS EXISTS: allow-same-origin is deliberately absent. Without it the frame
// is an opaque origin that cannot read the viewer's DOM, storage, or cookies.
// allow-scripts is safe only because of that omission, and exists solely for the
// nonce'd height reporter below.
export const IFRAME_SANDBOX = 'allow-scripts allow-popups allow-popups-to-escape-sandbox';

export const HEIGHT_MESSAGE_TYPE = 'eml-preview-height';

const BASE_STYLES = `
  html, body { margin: 0; padding: 16px; background: #fff; color: #111; }
  body { font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; overflow-wrap: break-word; }
  img { max-width: 100%; height: auto; }
  table { max-width: 100%; }
  img[data-blocked-src], img[data-blocked-background] {
    min-width: 12px; min-height: 12px;
    border: 1px dashed #bbb; border-radius: 2px; background: #f6f6f6;
  }
`;

function heightReporter() {
  return `
    (function () {
      var send = function () {
        parent.postMessage(
          { type: ${JSON.stringify(HEIGHT_MESSAGE_TYPE)}, height: document.documentElement.scrollHeight },
          '*'
        );
      };
      new ResizeObserver(send).observe(document.documentElement);
      addEventListener('load', send);
      send();
    })();
  `;
}

export function buildSrcdoc(bodyHtml, { nonce, allowRemoteImages = false } = {}) {
  if (!nonce) throw new Error('buildSrcdoc requires a nonce');

  const imgSrc = allowRemoteImages ? 'data: blob: https: http:' : 'data: blob:';
  const csp = [
    "default-src 'none'",
    `img-src ${imgSrc}`,
    "style-src 'unsafe-inline'",
    `script-src 'nonce-${nonce}'`,
    "object-src 'none'",
    "frame-src 'none'",
    "form-action 'none'",
  ].join('; ');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<base target="_blank">
<style>${BASE_STYLES}</style>
</head>
<body>
${bodyHtml}
<script nonce="${nonce}">${heightReporter()}</script>
</body>
</html>`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/build-srcdoc.test.js`
Expected: PASS — 9 tests green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: wrap sanitized email html in a csp-locked sandboxed srcdoc"
```

---

### Task 7: Source loading

**Files:**
- Create: `src/lib/source-loader.js`
- Test: `test/source-loader.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `class SourceError extends Error` with a `.kind` of `'file-access-denied' | 'fetch-failed' | 'permission-denied'`
  - `loadFromUrl(src: string, { fetchImpl?: typeof fetch }): Promise<ArrayBuffer>`
  - `loadFromFile(file: File): Promise<ArrayBuffer>`
  - `isFileUrl(src: string): boolean`

- [ ] **Step 1: Write the failing test**

Create `test/source-loader.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { loadFromUrl, loadFromFile, isFileUrl, SourceError } from '../src/lib/source-loader.js';

const okResponse = (text) => ({
  ok: true,
  status: 200,
  arrayBuffer: async () => new TextEncoder().encode(text).buffer,
});

describe('isFileUrl', () => {
  it('recognises file urls only', () => {
    expect(isFileUrl('file:///tmp/a.eml')).toBe(true);
    expect(isFileUrl('https://example.com/a.eml')).toBe(false);
  });
});

describe('loadFromUrl', () => {
  it('returns the fetched bytes', async () => {
    const buf = await loadFromUrl('https://example.com/a.eml', {
      fetchImpl: async () => okResponse('hello'),
    });
    expect(new TextDecoder().decode(buf)).toBe('hello');
  });

  it('sends credentials for http but not for file', async () => {
    const seen = [];
    const fetchImpl = async (url, init) => {
      seen.push(init.credentials);
      return okResponse('x');
    };
    await loadFromUrl('https://example.com/a.eml', { fetchImpl });
    await loadFromUrl('file:///tmp/a.eml', { fetchImpl });
    expect(seen).toEqual(['include', 'omit']);
  });

  it('reports file-access-denied when a file fetch throws', async () => {
    const err = await loadFromUrl('file:///tmp/a.eml', {
      fetchImpl: async () => { throw new TypeError('Failed to fetch'); },
    }).catch((e) => e);
    expect(err).toBeInstanceOf(SourceError);
    expect(err.kind).toBe('file-access-denied');
  });

  it('reports fetch-failed when an http fetch throws', async () => {
    const err = await loadFromUrl('https://example.com/a.eml', {
      fetchImpl: async () => { throw new TypeError('Failed to fetch'); },
    }).catch((e) => e);
    expect(err.kind).toBe('fetch-failed');
  });

  it('reports fetch-failed with the status on a non-ok response', async () => {
    const err = await loadFromUrl('https://example.com/a.eml', {
      fetchImpl: async () => ({ ok: false, status: 404 }),
    }).catch((e) => e);
    expect(err.kind).toBe('fetch-failed');
    expect(err.message).toContain('404');
  });
});

describe('loadFromFile', () => {
  it('returns the file bytes', async () => {
    const file = new File(['from disk'], 'a.eml', { type: 'message/rfc822' });
    const buf = await loadFromFile(file);
    expect(new TextDecoder().decode(buf)).toBe('from disk');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/source-loader.test.js`
Expected: FAIL — cannot resolve `../src/lib/source-loader.js`.

- [ ] **Step 3: Write `src/lib/source-loader.js`**

```js
export class SourceError extends Error {
  constructor(kind, message, options) {
    super(message, options);
    this.name = 'SourceError';
    this.kind = kind;
  }
}

export function isFileUrl(src) {
  return typeof src === 'string' && src.toLowerCase().startsWith('file:');
}

export async function loadFromUrl(src, { fetchImpl = fetch } = {}) {
  const file = isFileUrl(src);
  let response;

  try {
    response = await fetchImpl(src, { credentials: file ? 'omit' : 'include' });
  } catch (cause) {
    throw file
      ? new SourceError('file-access-denied', 'Chrome blocked access to this local file.', { cause })
      : new SourceError('fetch-failed', `Could not fetch ${src}`, { cause });
  }

  if (!response.ok) {
    throw new SourceError('fetch-failed', `Request failed with HTTP ${response.status}.`);
  }
  return response.arrayBuffer();
}

export function loadFromFile(file) {
  return file.arrayBuffer();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/source-loader.test.js`
Expected: PASS — 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: load .eml bytes from file, http and File sources"
```

---

### Task 8: Interception rules and the service worker

**Files:**
- Create: `src/background/intercept-rules.js`
- Modify: `src/background/service-worker.js` (replace the placeholder comment)
- Test: `test/intercept-rules.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `isEmlUrl(url: string): boolean`
  - `shouldInterceptDownload(item: { url?, finalUrl?, filename?, mime? }): boolean`
  - `viewerUrlFor(src: string, viewerPath: string): string`

- [ ] **Step 1: Write the failing test**

Create `test/intercept-rules.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { isEmlUrl, shouldInterceptDownload, viewerUrlFor } from '../src/background/intercept-rules.js';

describe('isEmlUrl', () => {
  it('matches file and http(s) urls ending in .eml', () => {
    expect(isEmlUrl('file:///Users/me/msg.eml')).toBe(true);
    expect(isEmlUrl('https://example.com/a/b/msg.eml')).toBe(true);
    expect(isEmlUrl('http://example.com/msg.EML')).toBe(true);
  });

  it('matches despite a query string or fragment', () => {
    expect(isEmlUrl('https://example.com/msg.eml?token=1')).toBe(true);
    expect(isEmlUrl('https://example.com/msg.eml#top')).toBe(true);
  });

  it('matches percent-encoded paths', () => {
    expect(isEmlUrl('file:///Users/me/my%20message.eml')).toBe(true);
  });

  it('rejects other extensions, other schemes and junk', () => {
    expect(isEmlUrl('https://example.com/msg.pdf')).toBe(false);
    expect(isEmlUrl('chrome-extension://abc/viewer.html')).toBe(false);
    expect(isEmlUrl('not a url')).toBe(false);
    expect(isEmlUrl(undefined)).toBe(false);
  });

  it('does not match a path that merely contains .eml', () => {
    expect(isEmlUrl('https://example.com/msg.eml.txt')).toBe(false);
  });
});

describe('shouldInterceptDownload', () => {
  it('intercepts message/rfc822 downloads', () => {
    expect(shouldInterceptDownload({ url: 'https://example.com/dl?id=7', mime: 'message/rfc822' })).toBe(true);
  });

  it('intercepts by .eml filename when the mime is generic', () => {
    expect(shouldInterceptDownload({
      url: 'https://example.com/dl?id=7',
      filename: '/Users/me/Downloads/msg.eml',
      mime: 'application/octet-stream',
    })).toBe(true);
  });

  it('prefers finalUrl when present', () => {
    expect(shouldInterceptDownload({ url: 'https://a.example/r', finalUrl: 'https://b.example/m.eml' })).toBe(true);
  });

  it('never intercepts our own blob or data downloads', () => {
    expect(shouldInterceptDownload({ url: 'blob:chrome-extension://abc/1', mime: 'message/rfc822' })).toBe(false);
    expect(shouldInterceptDownload({ url: 'data:message/rfc822,x', mime: 'message/rfc822' })).toBe(false);
  });

  it('ignores ordinary downloads and missing items', () => {
    expect(shouldInterceptDownload({ url: 'https://example.com/a.pdf', mime: 'application/pdf' })).toBe(false);
    expect(shouldInterceptDownload(null)).toBe(false);
  });
});

describe('viewerUrlFor', () => {
  it('encodes the source into the src param', () => {
    expect(viewerUrlFor('file:///a b.eml', 'chrome-extension://abc/viewer.html'))
      .toBe('chrome-extension://abc/viewer.html?src=file%3A%2F%2F%2Fa%20b.eml');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/intercept-rules.test.js`
Expected: FAIL — cannot resolve `../src/background/intercept-rules.js`.

- [ ] **Step 3: Write `src/background/intercept-rules.js`**

```js
const EML_PATH = /\.eml$/i;
const INTERCEPTABLE_SCHEMES = new Set(['file:', 'http:', 'https:']);

export function isEmlUrl(url) {
  if (typeof url !== 'string') return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (!INTERCEPTABLE_SCHEMES.has(parsed.protocol)) return false;

  let path = parsed.pathname;
  try {
    path = decodeURIComponent(path);
  } catch {
    // Leave the raw pathname in place if it is not valid percent-encoding.
  }
  return EML_PATH.test(path);
}

export function shouldInterceptDownload(item) {
  if (!item) return false;
  const url = item.finalUrl || item.url || '';

  // Downloads we ourselves initiate (the "Download original" button) use blob: URLs.
  // Intercepting those would trap the user in a loop.
  if (url.startsWith('blob:') || url.startsWith('data:')) return false;

  if (item.mime === 'message/rfc822') return true;
  if (isEmlUrl(url)) return true;
  return EML_PATH.test(item.filename || '');
}

export function viewerUrlFor(src, viewerPath) {
  return `${viewerPath}?src=${encodeURIComponent(src)}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/intercept-rules.test.js`
Expected: PASS — 11 tests green.

- [ ] **Step 5: Write `src/background/service-worker.js`**

Replace the placeholder comment with:

```js
import { isEmlUrl, shouldInterceptDownload, viewerUrlFor } from './intercept-rules.js';

const viewerPath = () => chrome.runtime.getURL('viewer.html');

chrome.webNavigation.onBeforeNavigate.addListener(({ tabId, frameId, url }) => {
  if (frameId !== 0) return;
  if (!isEmlUrl(url)) return;
  chrome.tabs.update(tabId, { url: viewerUrlFor(url, viewerPath()) });
});

chrome.downloads.onCreated.addListener(async (item) => {
  if (!shouldInterceptDownload(item)) return;
  try {
    await chrome.downloads.cancel(item.id);
    await chrome.downloads.erase({ id: item.id });
  } catch {
    // The download may already have finished; opening the viewer is still correct.
  }
  chrome.tabs.create({ url: viewerUrlFor(item.finalUrl || item.url, viewerPath()) });
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: viewerPath() });
});
```

- [ ] **Step 6: Verify the build still succeeds**

Run: `npm run build && npm test`
Expected: build succeeds, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: intercept .eml navigations and downloads into the viewer"
```

---

### Task 9: Viewer shell — load, parse, render, error cards

**Files:**
- Create: `src/viewer/render-pipeline.js`, `src/viewer/ui/header-card.js`, `src/viewer/ui/error-card.js`, `src/viewer/ui/dropzone.js`, `src/viewer/format.js`
- Modify: `src/viewer/viewer.js` (replace the placeholder), `src/viewer/viewer.html`, `src/styles/viewer.css`
- Test: `test/render-pipeline.test.js`, `test/header-card.test.js`, `test/format.test.js`

**Interfaces:**
- Consumes: `parseEmail`, `sanitizeHtml`, `blockRemote`, `buildCidMap`, `inlineCid`, `buildSrcdoc`, `IFRAME_SANDBOX`, `loadFromUrl`, `loadFromFile`, `SourceError`.
- Produces:
  - `renderBody(model, { allowRemoteImages, nonce, createUrl }): { srcdoc: string, blockedCount: number }`
  - `renderHeaderCard(model): HTMLElement`
  - `renderErrorCard({ title, detail, actionLabel, onAction }): HTMLElement`
  - `renderDropzone(onFile): HTMLElement`
  - `formatAddress(addr)`, `formatAddressList(list)`, `formatBytes(n)`, `formatDate(iso)`

- [ ] **Step 1: Write the failing tests**

Create `test/format.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { formatAddress, formatAddressList, formatBytes, formatDate } from '../src/viewer/format.js';

describe('formatAddress', () => {
  it('renders name and address, or address alone', () => {
    expect(formatAddress({ name: 'Alice', address: 'a@b.c' })).toBe('Alice <a@b.c>');
    expect(formatAddress({ name: '', address: 'a@b.c' })).toBe('a@b.c');
    expect(formatAddress(null)).toBe('');
  });
});

describe('formatAddressList', () => {
  it('joins with commas and tolerates empty input', () => {
    expect(formatAddressList([{ address: 'a@b.c' }, { name: 'D', address: 'd@e.f' }]))
      .toBe('a@b.c, D <d@e.f>');
    expect(formatAddressList([])).toBe('');
    expect(formatAddressList(undefined)).toBe('');
  });
});

describe('formatBytes', () => {
  it('scales to a readable unit', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('formatDate', () => {
  it('returns a readable string and passes junk through', () => {
    expect(formatDate('2026-08-10T09:00:00.000Z')).toMatch(/2026/);
    expect(formatDate('')).toBe('');
    expect(formatDate('not a date')).toBe('not a date');
  });
});
```

Create `test/render-pipeline.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { renderBody } from '../src/viewer/render-pipeline.js';
import { parseEmail } from '../src/lib/parse-email.js';
import { loadFixture } from './helpers/load-fixture.js';

const opts = (extra) => ({ nonce: 'N1', createUrl: () => 'blob:fake/0', ...extra });
const parse = async (name) => parseEmail(await loadFixture(name));

describe('renderBody', () => {
  it('blocks the tracking pixel and reports the count', async () => {
    const { srcdoc, blockedCount } = renderBody(await parse('hostile.eml'), opts());
    expect(blockedCount).toBe(1);
    expect(srcdoc).not.toContain('tracker.example.com/pixel.gif"');
    expect(srcdoc).toContain('data-blocked-src');
    expect(srcdoc).toContain("img-src data: blob:;");
  });

  it('lets remote images through when allowed, with the relaxed policy', async () => {
    const { srcdoc, blockedCount } = renderBody(
      await parse('hostile.eml'),
      opts({ allowRemoteImages: true })
    );
    expect(blockedCount).toBe(0);
    expect(srcdoc).toContain('https://tracker.example.com/pixel.gif');
    expect(srcdoc).toContain('img-src data: blob: https: http:');
  });

  it('strips scripts and iframes regardless of the remote setting', async () => {
    for (const allowRemoteImages of [false, true]) {
      const { srcdoc } = renderBody(await parse('hostile.eml'), opts({ allowRemoteImages }));
      expect(srcdoc).not.toContain('document.cookie');
      expect(srcdoc).not.toContain('evil.example.com');
      expect(srcdoc).not.toContain('onerror');
    }
  });

  it('inlines cid images', async () => {
    const { srcdoc } = renderBody(await parse('multipart-related-cid.eml'), opts());
    expect(srcdoc).toContain('src="blob:fake/0"');
  });

  it('falls back to escaped plain text when there is no html part', async () => {
    const { srcdoc } = renderBody(await parse('plain-text.eml'), opts());
    expect(srcdoc).toContain('<pre');
    expect(srcdoc).toContain('Hello Bob.');
  });

  it('escapes html metacharacters in the plain text fallback', () => {
    const model = { html: null, text: '<script>alert(1)</script>', attachments: [] };
    const { srcdoc } = renderBody(model, opts());
    expect(srcdoc).toContain('&lt;script&gt;');
    expect(srcdoc).not.toContain('<script>alert(1)</script>');
  });

  it('renders an empty-body notice when there is neither html nor text', () => {
    const { srcdoc } = renderBody({ html: null, text: null, attachments: [] }, opts());
    expect(srcdoc).toContain('This message has no readable body.');
  });
});
```

Create `test/header-card.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { renderHeaderCard } from '../src/viewer/ui/header-card.js';
import { renderErrorCard } from '../src/viewer/ui/error-card.js';
import { parseEmail } from '../src/lib/parse-email.js';
import { loadFixture } from './helpers/load-fixture.js';

describe('renderHeaderCard', () => {
  it('shows subject, from, to and date', async () => {
    const el = renderHeaderCard(await parseEmail(await loadFixture('plain-text.eml')));
    expect(el.textContent).toContain('Plain text hello');
    expect(el.textContent).toContain('Alice <alice@example.com>');
    expect(el.textContent).toContain('bob@example.com');
    expect(el.textContent).toMatch(/2026/);
  });

  it('omits rows that have no value', async () => {
    const el = renderHeaderCard(await parseEmail(await loadFixture('plain-text.eml')));
    expect(el.textContent).not.toContain('Cc');
  });

  it('uses a placeholder when the subject is empty', () => {
    const el = renderHeaderCard({ subject: '', from: null, to: [], cc: [], date: '' });
    expect(el.textContent).toContain('(no subject)');
  });

  it('escapes header values rather than interpreting them as html', () => {
    const el = renderHeaderCard({ subject: '<img src=x onerror=alert(1)>', from: null, to: [], cc: [], date: '' });
    expect(el.querySelectorAll('img')).toHaveLength(0);
    expect(el.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});

describe('renderErrorCard', () => {
  it('shows the title and detail', () => {
    const el = renderErrorCard({ title: 'Nope', detail: 'because reasons' });
    expect(el.textContent).toContain('Nope');
    expect(el.textContent).toContain('because reasons');
  });

  it('wires the action button when one is given', () => {
    let clicked = 0;
    const el = renderErrorCard({ title: 'X', detail: 'y', actionLabel: 'Retry', onAction: () => { clicked += 1; } });
    el.querySelector('button').click();
    expect(clicked).toBe(1);
  });

  it('renders no button when no action is given', () => {
    expect(renderErrorCard({ title: 'X', detail: 'y' }).querySelector('button')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/format.test.js test/render-pipeline.test.js test/header-card.test.js`
Expected: FAIL — none of the modules resolve.

- [ ] **Step 3: Write `src/viewer/format.js`**

```js
export function formatAddress(addr) {
  if (!addr || !addr.address) return '';
  return addr.name ? `${addr.name} <${addr.address}>` : addr.address;
}

export function formatAddressList(list) {
  if (!Array.isArray(list) || list.length === 0) return '';
  return list.map(formatAddress).filter(Boolean).join(', ');
}

export function formatBytes(n) {
  if (!n) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
```

- [ ] **Step 4: Write `src/viewer/render-pipeline.js`**

```js
import { sanitizeHtml } from '../lib/sanitize-html.js';
import { blockRemote } from '../lib/block-remote.js';
import { buildCidMap, inlineCid } from '../lib/inline-cid.js';
import { buildSrcdoc } from '../lib/build-srcdoc.js';

const EMPTY_BODY = '<p><em>This message has no readable body.</em></p>';

export function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function textToHtml(text) {
  return `<pre style="white-space: pre-wrap; font: inherit; margin: 0">${escapeHtml(text)}</pre>`;
}

export function renderBody(model, { allowRemoteImages = false, nonce, createUrl } = {}) {
  let fragment;

  if (model.html) {
    const cidMap = buildCidMap(model.attachments, createUrl);
    fragment = sanitizeHtml(inlineCid(model.html, cidMap));
  } else if (model.text) {
    fragment = textToHtml(model.text);
  } else {
    fragment = EMPTY_BODY;
  }

  let blockedCount = 0;
  if (!allowRemoteImages) {
    const blocked = blockRemote(fragment);
    fragment = blocked.html;
    blockedCount = blocked.blockedCount;
  }

  return { srcdoc: buildSrcdoc(fragment, { nonce, allowRemoteImages }), blockedCount };
}
```

`buildCidMap` is called with `createUrl` undefined in production, which falls through to its `URL.createObjectURL` default.

- [ ] **Step 5: Write `src/viewer/ui/header-card.js`**

```js
import { formatAddress, formatAddressList, formatDate } from '../format.js';

function row(label, value) {
  const dt = document.createElement('dt');
  dt.textContent = label;
  const dd = document.createElement('dd');
  dd.textContent = value;
  return [dt, dd];
}

export function renderHeaderCard(model) {
  const card = document.createElement('section');
  card.className = 'header-card';

  const subject = document.createElement('h1');
  subject.className = 'header-card__subject';
  subject.textContent = model.subject || '(no subject)';
  card.append(subject);

  const dl = document.createElement('dl');
  dl.className = 'header-card__fields';

  const fields = [
    ['From', formatAddress(model.from)],
    ['To', formatAddressList(model.to)],
    ['Cc', formatAddressList(model.cc)],
    ['Date', formatDate(model.date)],
  ];
  for (const [label, value] of fields) {
    if (!value) continue;
    dl.append(...row(label, value));
  }

  card.append(dl);
  return card;
}
```

- [ ] **Step 6: Write `src/viewer/ui/error-card.js`**

```js
export function renderErrorCard({ title, detail, actionLabel, onAction }) {
  const card = document.createElement('section');
  card.className = 'error-card';

  const h = document.createElement('h2');
  h.textContent = title;
  card.append(h);

  const p = document.createElement('p');
  p.textContent = detail;
  card.append(p);

  if (actionLabel && onAction) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = actionLabel;
    button.addEventListener('click', onAction);
    card.append(button);
  }
  return card;
}
```

- [ ] **Step 7: Write `src/viewer/ui/dropzone.js`**

```js
export function renderDropzone(onFile) {
  const zone = document.createElement('section');
  zone.className = 'dropzone';

  const label = document.createElement('p');
  label.textContent = 'Drop an .eml file here, or';
  zone.append(label);

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.eml,message/rfc822';
  input.addEventListener('change', () => {
    if (input.files[0]) onFile(input.files[0]);
  });
  zone.append(input);

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dropzone--over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('dropzone--over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dropzone--over');
    const file = e.dataTransfer?.files?.[0];
    if (file) onFile(file);
  });

  return zone;
}
```

- [ ] **Step 8: Write `src/viewer/viewer.js`**

```js
import { parseEmail, EmailParseError } from '../lib/parse-email.js';
import { loadFromUrl, loadFromFile, SourceError } from '../lib/source-loader.js';
import { IFRAME_SANDBOX, HEIGHT_MESSAGE_TYPE } from '../lib/build-srcdoc.js';
import { renderBody } from './render-pipeline.js';
import { renderHeaderCard } from './ui/header-card.js';
import { renderErrorCard } from './ui/error-card.js';
import { renderDropzone } from './ui/dropzone.js';

const app = document.getElementById('app');

const state = {
  model: null,
  bytes: null,
  source: null,
  allowRemoteImages: false,
};

function clear() {
  app.replaceChildren();
}

function showError({ title, detail, actionLabel, onAction }) {
  clear();
  app.append(renderErrorCard({ title, detail, actionLabel, onAction }));
}

function bodyFrame() {
  const frame = document.createElement('iframe');
  frame.className = 'body-frame';
  frame.setAttribute('sandbox', IFRAME_SANDBOX);
  frame.setAttribute('title', 'Message body');

  const { srcdoc } = renderBody(state.model, {
    allowRemoteImages: state.allowRemoteImages,
    nonce: crypto.randomUUID(),
  });
  frame.srcdoc = srcdoc;

  window.addEventListener('message', (event) => {
    if (event.source !== frame.contentWindow) return;
    if (event.data?.type !== HEIGHT_MESSAGE_TYPE) return;
    frame.style.height = `${event.data.height}px`;
  });

  return frame;
}

function renderMessage() {
  clear();
  app.append(renderHeaderCard(state.model), bodyFrame());
}

async function openBytes(bytes, source) {
  state.bytes = bytes;
  state.source = source;
  try {
    state.model = await parseEmail(bytes);
  } catch (error) {
    if (error instanceof EmailParseError) {
      showError({
        title: 'Not a readable email',
        detail: 'This file could not be parsed as an RFC 822 message.',
      });
      return;
    }
    throw error;
  }
  renderMessage();
}

function showPicker() {
  clear();
  app.append(renderDropzone(async (file) => {
    openBytes(await loadFromFile(file), file.name);
  }));
}

async function openUrl(src) {
  try {
    await openBytes(await loadFromUrl(src), src);
  } catch (error) {
    if (!(error instanceof SourceError)) throw error;
    if (error.kind === 'file-access-denied') {
      showError({
        title: 'Chrome blocked access to this file',
        detail:
          'Open chrome://extensions, click Details on EML Preview, and turn on ' +
          '"Allow access to file URLs". Then reload this tab.',
      });
      return;
    }
    showError({ title: 'Could not load this message', detail: `${error.message} (${src})` });
  }
}

const src = new URLSearchParams(location.search).get('src');
if (src) {
  openUrl(src);
} else {
  showPicker();
}
```

- [ ] **Step 9: Add the viewer styles**

Append to `src/styles/viewer.css`:

```css
.header-card {
  border-bottom: 1px solid var(--line);
  padding-bottom: 16px;
  margin-bottom: 16px;
}

.header-card__subject {
  margin: 0 0 12px;
  font-size: 20px;
  line-height: 1.3;
}

.header-card__fields {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 12px;
  margin: 0;
}

.header-card__fields dt {
  color: var(--muted);
}

.header-card__fields dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.body-frame {
  display: block;
  width: 100%;
  min-height: 200px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fff;
}

.error-card {
  border: 1px solid var(--line);
  border-left: 3px solid #dc2626;
  border-radius: 6px;
  padding: 16px;
}

.error-card h2 {
  margin: 0 0 8px;
  font-size: 16px;
}

.dropzone {
  border: 2px dashed var(--line);
  border-radius: 8px;
  padding: 48px 24px;
  text-align: center;
  color: var(--muted);
}

.dropzone--over {
  border-color: var(--accent);
}

button {
  font: inherit;
  padding: 6px 12px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

button:hover {
  border-color: var(--accent);
  color: var(--accent);
}
```

- [ ] **Step 10: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — all suites green.

- [ ] **Step 11: Verify in Chrome**

Run `npm run build`, open `chrome://extensions`, enable Developer mode, **Load unpacked** → select `dist/`. Click the extension icon. Drag `test/fixtures/multipart-related-cid.eml` into the drop zone. Confirm the header card shows "Inline image" and the body frame renders with the logo `<img>` present.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: render parsed messages in a sandboxed viewer with error cards"
```

---

### Task 10: Content tabs and the header inspector

**Files:**
- Create: `src/viewer/ui/tabs.js`, `src/viewer/ui/header-inspector.js`
- Modify: `src/viewer/viewer.js`, `src/styles/viewer.css`
- Test: `test/tabs.test.js`, `test/header-inspector.test.js`

**Interfaces:**
- Consumes: `EmailModel`.
- Produces:
  - `buildTabs(model): { id, label, enabled }[]` where `id` is one of `'html' | 'text' | 'raw' | 'headers'`
  - `renderTabBar(tabs, activeId, onSelect): HTMLElement`
  - `renderHeaderInspector(model): HTMLElement`
- The viewer gains: `state.activeTab`, and `state.rawText` (the source bytes decoded as UTF-8).

- [ ] **Step 1: Write the failing tests**

Create `test/tabs.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { buildTabs, renderTabBar } from '../src/viewer/ui/tabs.js';

describe('buildTabs', () => {
  it('always offers four tabs in a fixed order', () => {
    const tabs = buildTabs({ html: '<p>x</p>', text: 'x', headers: [] });
    expect(tabs.map((t) => t.id)).toEqual(['html', 'text', 'raw', 'headers']);
  });

  it('disables html when there is no html part', () => {
    const tabs = buildTabs({ html: null, text: 'x', headers: [] });
    expect(tabs.find((t) => t.id === 'html').enabled).toBe(false);
    expect(tabs.find((t) => t.id === 'text').enabled).toBe(true);
  });

  it('disables text when there is no plain part', () => {
    const tabs = buildTabs({ html: '<p>x</p>', text: null, headers: [] });
    expect(tabs.find((t) => t.id === 'text').enabled).toBe(false);
  });

  it('always enables raw and headers', () => {
    const tabs = buildTabs({ html: null, text: null, headers: [] });
    expect(tabs.find((t) => t.id === 'raw').enabled).toBe(true);
    expect(tabs.find((t) => t.id === 'headers').enabled).toBe(true);
  });
});

describe('renderTabBar', () => {
  it('marks the active tab and disables unavailable ones', () => {
    const tabs = buildTabs({ html: null, text: 'x', headers: [] });
    const bar = renderTabBar(tabs, 'text', () => {});
    const buttons = [...bar.querySelectorAll('button')];
    expect(buttons.find((b) => b.dataset.tabId === 'html').disabled).toBe(true);
    expect(buttons.find((b) => b.dataset.tabId === 'text').getAttribute('aria-selected')).toBe('true');
  });

  it('reports selection and ignores disabled tabs', () => {
    const tabs = buildTabs({ html: null, text: 'x', headers: [] });
    const chosen = [];
    const bar = renderTabBar(tabs, 'text', (id) => chosen.push(id));
    bar.querySelector('[data-tab-id="raw"]').click();
    bar.querySelector('[data-tab-id="html"]').click();
    expect(chosen).toEqual(['raw']);
  });
});
```

Create `test/header-inspector.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { renderHeaderInspector } from '../src/viewer/ui/header-inspector.js';
import { parseEmail } from '../src/lib/parse-email.js';
import { loadFixture } from './helpers/load-fixture.js';

describe('renderHeaderInspector', () => {
  it('lists every header in file order', async () => {
    const model = await parseEmail(await loadFixture('plain-text.eml'));
    const el = renderHeaderInspector(model);
    const keys = [...el.querySelectorAll('th')].map((th) => th.textContent.toLowerCase());
    expect(keys).toContain('subject');
    expect(keys).toContain('message-id');
    expect(keys.length).toBe(model.headers.length);
  });

  it('renders values as text, never as markup', () => {
    const el = renderHeaderInspector({ headers: [{ key: 'X-Evil', value: '<img src=x onerror=alert(1)>' }] });
    expect(el.querySelectorAll('img')).toHaveLength(0);
    expect(el.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('says so when there are no headers', () => {
    expect(renderHeaderInspector({ headers: [] }).textContent).toContain('No headers');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/tabs.test.js test/header-inspector.test.js`
Expected: FAIL — modules do not resolve.

- [ ] **Step 3: Write `src/viewer/ui/tabs.js`**

```js
export function buildTabs(model) {
  return [
    { id: 'html', label: 'HTML', enabled: Boolean(model.html) },
    { id: 'text', label: 'Text', enabled: Boolean(model.text) },
    { id: 'raw', label: 'Raw', enabled: true },
    { id: 'headers', label: 'Headers', enabled: true },
  ];
}

export function renderTabBar(tabs, activeId, onSelect) {
  const bar = document.createElement('nav');
  bar.className = 'tabbar';
  bar.setAttribute('role', 'tablist');

  for (const tab of tabs) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.tabId = tab.id;
    button.textContent = tab.label;
    button.disabled = !tab.enabled;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(tab.id === activeId));
    button.addEventListener('click', () => onSelect(tab.id));
    bar.append(button);
  }
  return bar;
}
```

`button.disabled` already suppresses the click event, which is what the "ignores disabled tabs" test asserts.

- [ ] **Step 4: Write `src/viewer/ui/header-inspector.js`**

```js
export function renderHeaderInspector(model) {
  const wrap = document.createElement('section');
  wrap.className = 'header-inspector';

  const headers = model.headers ?? [];
  if (headers.length === 0) {
    const p = document.createElement('p');
    p.textContent = 'No headers were found in this message.';
    wrap.append(p);
    return wrap;
  }

  const table = document.createElement('table');
  const tbody = document.createElement('tbody');

  for (const { key, value } of headers) {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = key;
    const td = document.createElement('td');
    td.textContent = value;
    tr.append(th, td);
    tbody.append(tr);
  }

  table.append(tbody);
  wrap.append(table);
  return wrap;
}
```

- [ ] **Step 5: Wire tabs into `src/viewer/viewer.js`**

Add these imports alongside the existing ones:

```js
import { buildTabs, renderTabBar } from './ui/tabs.js';
import { renderHeaderInspector } from './ui/header-inspector.js';
```

Add `activeTab: 'html'` and `rawText: ''` to `state`.

Replace `renderMessage` with:

```js
function renderPane() {
  if (state.activeTab === 'headers') return renderHeaderInspector(state.model);

  if (state.activeTab === 'text' || state.activeTab === 'raw') {
    const pre = document.createElement('pre');
    pre.className = 'plain-pane';
    pre.textContent = state.activeTab === 'text' ? state.model.text : state.rawText;
    return pre;
  }
  return bodyFrame();
}

function renderMessage() {
  const tabs = buildTabs(state.model);
  if (!tabs.find((t) => t.id === state.activeTab)?.enabled) {
    state.activeTab = tabs.find((t) => t.enabled).id;
  }

  clear();
  app.append(
    renderHeaderCard(state.model),
    renderTabBar(tabs, state.activeTab, (id) => {
      state.activeTab = id;
      renderMessage();
    }),
    renderPane()
  );
}
```

In `openBytes`, before `renderMessage()`, decode the raw source once:

```js
state.rawText = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
state.activeTab = state.model.html ? 'html' : state.model.text ? 'text' : 'raw';
```

- [ ] **Step 6: Add tab and pane styles**

Append to `src/styles/viewer.css`:

```css
.tabbar {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--line);
}

.tabbar button {
  border: none;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  padding: 8px 12px;
}

.tabbar button[aria-selected='true'] {
  border-bottom-color: var(--accent);
  color: var(--accent);
}

.tabbar button:disabled {
  opacity: 0.4;
  cursor: default;
}

.plain-pane {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 16px;
  margin: 0;
  font: 12px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace;
}

.header-inspector table {
  width: 100%;
  border-collapse: collapse;
  font: 12px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace;
}

.header-inspector th,
.header-inspector td {
  text-align: left;
  vertical-align: top;
  padding: 4px 8px;
  border-bottom: 1px solid var(--line);
  overflow-wrap: anywhere;
}

.header-inspector th {
  color: var(--muted);
  font-weight: 500;
  white-space: nowrap;
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — all suites green.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add html/text/raw/headers tabs and header inspector"
```

---

### Task 11: Attachments strip

**Files:**
- Create: `src/viewer/ui/attachments.js`
- Modify: `src/viewer/viewer.js`, `src/styles/viewer.css`
- Test: `test/attachments.test.js`

**Interfaces:**
- Consumes: `Attachment[]`, `formatBytes`.
- Produces: `renderAttachments(attachments, { onOpenNested, createUrl })` returning `HTMLElement | null`. Returns `null` when there is nothing to show. `createUrl` defaults to `URL.createObjectURL`; `onOpenNested(attachment)` is called instead of downloading for `message/rfc822` parts.

- [ ] **Step 1: Write the failing test**

Create `test/attachments.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { renderAttachments } from '../src/viewer/ui/attachments.js';
import { parseEmail } from '../src/lib/parse-email.js';
import { loadFixture } from './helpers/load-fixture.js';

const createUrl = () => 'blob:fake/0';

describe('renderAttachments', () => {
  it('returns null when there are no attachments', () => {
    expect(renderAttachments([], { createUrl })).toBeNull();
  });

  it('returns null when every attachment is an inline cid image', async () => {
    const model = await parseEmail(await loadFixture('multipart-related-cid.eml'));
    expect(renderAttachments(model.attachments, { createUrl })).toBeNull();
  });

  it('lists a regular attachment with filename, type and size', async () => {
    const model = await parseEmail(await loadFixture('with-attachment.eml'));
    const el = renderAttachments(model.attachments, { createUrl });
    expect(el.textContent).toContain('report.txt');
    expect(el.textContent).toContain('text/plain');
    expect(el.textContent).toContain('12 B');
  });

  it('gives a regular attachment a download link', async () => {
    const model = await parseEmail(await loadFixture('with-attachment.eml'));
    const el = renderAttachments(model.attachments, { createUrl });
    const link = el.querySelector('a[download]');
    expect(link.getAttribute('href')).toBe('blob:fake/0');
    expect(link.getAttribute('download')).toBe('report.txt');
  });

  it('opens a nested rfc822 attachment instead of downloading it', async () => {
    const model = await parseEmail(await loadFixture('nested-rfc822.eml'));
    const opened = [];
    const el = renderAttachments(model.attachments, { createUrl, onOpenNested: (a) => opened.push(a) });
    const button = el.querySelector('button');
    expect(button.textContent).toContain('Open');
    button.click();
    expect(opened).toHaveLength(1);
    expect(opened[0].mimeType).toBe('message/rfc822');
  });

  it('escapes filenames rather than interpreting them as html', () => {
    const el = renderAttachments(
      [{ filename: '<b>x</b>.txt', mimeType: 'text/plain', size: 1, content: new ArrayBuffer(1), disposition: 'attachment', related: false }],
      { createUrl }
    );
    expect(el.querySelectorAll('b')).toHaveLength(0);
    expect(el.textContent).toContain('<b>x</b>.txt');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/attachments.test.js`
Expected: FAIL — cannot resolve `../src/viewer/ui/attachments.js`.

- [ ] **Step 3: Write `src/viewer/ui/attachments.js`**

```js
import { formatBytes } from '../format.js';

const defaultCreateUrl = (blob) => URL.createObjectURL(blob);

function isDisplayed(att) {
  // Inline images already appear in the body; showing them again is noise.
  return !(att.related && att.contentId);
}

function meta(att) {
  const span = document.createElement('span');
  span.className = 'attachment__meta';
  span.textContent = `${att.mimeType} · ${formatBytes(att.size)}`;
  return span;
}

export function renderAttachments(attachments = [], { onOpenNested, createUrl = defaultCreateUrl } = {}) {
  const shown = attachments.filter(isDisplayed);
  if (shown.length === 0) return null;

  const section = document.createElement('section');
  section.className = 'attachments';

  const heading = document.createElement('h2');
  heading.textContent = `Attachments (${shown.length})`;
  section.append(heading);

  const list = document.createElement('ul');

  for (const att of shown) {
    const item = document.createElement('li');
    item.className = 'attachment';

    const name = document.createElement('span');
    name.className = 'attachment__name';
    name.textContent = att.filename;
    item.append(name, meta(att));

    if (att.mimeType === 'message/rfc822' && onOpenNested) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Open';
      button.addEventListener('click', () => onOpenNested(att));
      item.append(button);
    } else {
      const link = document.createElement('a');
      link.href = createUrl(new Blob([att.content], { type: att.mimeType }));
      link.download = att.filename;
      link.textContent = 'Download';
      item.append(link);
    }

    list.append(item);
  }

  section.append(list);
  return section;
}
```

- [ ] **Step 4: Wire attachments into `src/viewer/viewer.js`**

Add the import:

```js
import { renderAttachments } from './ui/attachments.js';
```

In `renderMessage`, after appending `renderPane()`:

```js
  const strip = renderAttachments(state.model.attachments, {
    onOpenNested: (att) => openBytes(att.content, att.filename),
  });
  if (strip) app.append(strip);
```

`openBytes` already re-renders from scratch, so opening a nested message replaces the current view. This is a deliberate simplification over the spec's "new tab": a nested `.eml` lives only in memory as an `ArrayBuffer`, and there is no URL a new tab could be pointed at without persisting it.

- [ ] **Step 5: Add attachment styles**

Append to `src/styles/viewer.css`:

```css
.attachments {
  margin-top: 24px;
  border-top: 1px solid var(--line);
  padding-top: 16px;
}

.attachments h2 {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--muted);
  font-weight: 500;
}

.attachments ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.attachment {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 8px 12px;
}

.attachment__name {
  font-weight: 500;
  overflow-wrap: anywhere;
}

.attachment__meta {
  color: var(--muted);
  font-size: 12px;
  margin-right: auto;
  white-space: nowrap;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — all suites green.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: list attachments with download and nested message support"
```

---

### Task 12: Remote content banner, host permission, download original

**Files:**
- Create: `src/viewer/ui/banner.js`, `src/viewer/ui/toolbar.js`, `src/viewer/host-permission.js`
- Modify: `src/viewer/viewer.js`, `src/styles/viewer.css`
- Test: `test/banner.test.js`, `test/toolbar.test.js`

**Interfaces:**
- Consumes: `blockedCount` from `renderBody`.
- Produces:
  - `renderBanner(blockedCount, onLoad): HTMLElement | null` — `null` when the count is 0
  - `renderToolbar({ onPrint, onDownload }): HTMLElement`
  - `hasHostPermission(src): Promise<boolean>` and `requestHostPermission(src): Promise<boolean>` (chrome-only, not unit tested)

- [ ] **Step 1: Write the failing tests**

Create `test/banner.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { renderBanner } from '../src/viewer/ui/banner.js';

describe('renderBanner', () => {
  it('renders nothing when nothing was blocked', () => {
    expect(renderBanner(0, () => {})).toBeNull();
  });

  it('uses singular wording for one blocked resource', () => {
    expect(renderBanner(1, () => {}).textContent).toContain('1 remote resource blocked');
  });

  it('uses plural wording for several', () => {
    expect(renderBanner(4, () => {}).textContent).toContain('4 remote resources blocked');
  });

  it('calls back when the load button is clicked', () => {
    let calls = 0;
    renderBanner(2, () => { calls += 1; }).querySelector('button').click();
    expect(calls).toBe(1);
  });
});
```

Create `test/toolbar.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { renderToolbar } from '../src/viewer/ui/toolbar.js';

describe('renderToolbar', () => {
  it('offers print and download actions', () => {
    const el = renderToolbar({ onPrint: () => {}, onDownload: () => {} });
    const labels = [...el.querySelectorAll('button')].map((b) => b.textContent);
    expect(labels).toEqual(['Print / Save as PDF', 'Download original']);
  });

  it('invokes each handler', () => {
    const calls = [];
    const el = renderToolbar({
      onPrint: () => calls.push('print'),
      onDownload: () => calls.push('download'),
    });
    for (const b of el.querySelectorAll('button')) b.click();
    expect(calls).toEqual(['print', 'download']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/banner.test.js test/toolbar.test.js`
Expected: FAIL — modules do not resolve.

- [ ] **Step 3: Write `src/viewer/ui/banner.js`**

```js
export function renderBanner(blockedCount, onLoad) {
  if (!blockedCount) return null;

  const bar = document.createElement('aside');
  bar.className = 'banner';

  const text = document.createElement('span');
  const noun = blockedCount === 1 ? 'resource' : 'resources';
  text.textContent = `${blockedCount} remote ${noun} blocked to protect your privacy.`;
  bar.append(text);

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Load remote content';
  button.addEventListener('click', onLoad);
  bar.append(button);

  return bar;
}
```

- [ ] **Step 4: Write `src/viewer/ui/toolbar.js`**

```js
export function renderToolbar({ onPrint, onDownload }) {
  const bar = document.createElement('div');
  bar.className = 'toolbar';

  const print = document.createElement('button');
  print.type = 'button';
  print.textContent = 'Print / Save as PDF';
  print.addEventListener('click', onPrint);

  const download = document.createElement('button');
  download.type = 'button';
  download.textContent = 'Download original';
  download.addEventListener('click', onDownload);

  bar.append(print, download);
  return bar;
}
```

- [ ] **Step 5: Write `src/viewer/host-permission.js`**

```js
function originPatternFor(src) {
  const { protocol, host } = new URL(src);
  if (protocol !== 'http:' && protocol !== 'https:') return null;
  return `${protocol}//${host}/*`;
}

export async function hasHostPermission(src) {
  const origins = originPatternFor(src);
  if (!origins) return true;
  return chrome.permissions.contains({ origins: [origins] });
}

// Must be called from a user gesture, or Chrome rejects it.
export async function requestHostPermission(src) {
  const origins = originPatternFor(src);
  if (!origins) return true;
  return chrome.permissions.request({ origins: [origins] });
}
```

- [ ] **Step 6: Wire everything into `src/viewer/viewer.js`**

Add imports:

```js
import { renderBanner } from './ui/banner.js';
import { renderToolbar } from './ui/toolbar.js';
import { hasHostPermission, requestHostPermission } from './host-permission.js';
```

Change `bodyFrame()` to return both the frame and the blocked count so the banner can be built:

```js
function bodyFrame() {
  const frame = document.createElement('iframe');
  frame.className = 'body-frame';
  frame.setAttribute('sandbox', IFRAME_SANDBOX);
  frame.setAttribute('title', 'Message body');

  const { srcdoc, blockedCount } = renderBody(state.model, {
    allowRemoteImages: state.allowRemoteImages,
    nonce: crypto.randomUUID(),
  });
  frame.srcdoc = srcdoc;

  window.addEventListener('message', (event) => {
    if (event.source !== frame.contentWindow) return;
    if (event.data?.type !== HEIGHT_MESSAGE_TYPE) return;
    frame.style.height = `${event.data.height}px`;
  });

  return { frame, blockedCount };
}
```

Change `renderPane()` to return `{ node, blockedCount }`:

```js
function renderPane() {
  if (state.activeTab === 'headers') {
    return { node: renderHeaderInspector(state.model), blockedCount: 0 };
  }
  if (state.activeTab === 'text' || state.activeTab === 'raw') {
    const pre = document.createElement('pre');
    pre.className = 'plain-pane';
    pre.textContent = state.activeTab === 'text' ? state.model.text : state.rawText;
    return { node: pre, blockedCount: 0 };
  }
  const { frame, blockedCount } = bodyFrame();
  return { node: frame, blockedCount };
}
```

Replace `renderMessage` with:

```js
function downloadOriginal() {
  const url = URL.createObjectURL(new Blob([state.bytes], { type: 'message/rfc822' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filenameFor(state.source);
  a.click();
  URL.revokeObjectURL(url);
}

function filenameFor(source) {
  if (!source) return 'message.eml';
  const last = source.split('/').pop().split('?')[0];
  return last || 'message.eml';
}

function renderMessage() {
  const tabs = buildTabs(state.model);
  if (!tabs.find((t) => t.id === state.activeTab)?.enabled) {
    state.activeTab = tabs.find((t) => t.enabled).id;
  }

  const pane = renderPane();

  clear();
  app.append(
    renderToolbar({ onPrint: () => window.print(), onDownload: downloadOriginal }),
    renderHeaderCard(state.model),
    renderTabBar(tabs, state.activeTab, (id) => {
      state.activeTab = id;
      renderMessage();
    })
  );

  const banner = renderBanner(pane.blockedCount, () => {
    state.allowRemoteImages = true;
    renderMessage();
  });
  if (banner) app.append(banner);

  app.append(pane.node);

  const strip = renderAttachments(state.model.attachments, {
    onOpenNested: (att) => openBytes(att.content, att.filename),
  });
  if (strip) app.append(strip);
}
```

Replace `openUrl` with a version that checks the optional host permission first:

```js
async function openUrl(src) {
  if (!(await hasHostPermission(src))) {
    showError({
      title: 'Permission needed',
      detail: `EML Preview needs permission to read messages from ${new URL(src).host}.`,
      actionLabel: 'Grant access',
      onAction: async () => {
        if (await requestHostPermission(src)) openUrl(src);
      },
    });
    return;
  }

  try {
    await openBytes(await loadFromUrl(src), src);
  } catch (error) {
    if (!(error instanceof SourceError)) throw error;
    if (error.kind === 'file-access-denied') {
      showError({
        title: 'Chrome blocked access to this file',
        detail:
          'Open chrome://extensions, click Details on EML Preview, and turn on ' +
          '"Allow access to file URLs". Then reload this tab.',
      });
      return;
    }
    showError({ title: 'Could not load this message', detail: `${error.message} (${src})` });
  }
}
```

Reset `state.allowRemoteImages = false` at the top of `openBytes`, so opening a nested message does not inherit the outer message's decision.

- [ ] **Step 7: Add banner and toolbar styles**

Append to `src/styles/viewer.css`:

```css
.toolbar {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 16px;
}

.banner {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, #d97706 40%, var(--bg));
  background: color-mix(in srgb, #d97706 10%, var(--bg));
  border-radius: 6px;
  font-size: 13px;
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — all suites green.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add remote content banner, host permission prompt and toolbar"
```

---

### Task 13: Print stylesheet and end-to-end verification

**Files:**
- Create: `src/styles/print.css`, `README.md`
- Modify: `src/viewer/viewer.html`
- Test: manual (documented below)

**Interfaces:**
- Consumes: everything.
- Produces: a print layout, and a README covering install and known limits.

- [ ] **Step 1: Write `src/styles/print.css`**

```css
@media print {
  .toolbar,
  .tabbar,
  .banner,
  .dropzone {
    display: none !important;
  }

  #app {
    max-width: none;
    padding: 0;
  }

  .body-frame {
    border: none;
    /* Height is set inline from the frame's reported content height, so the
       whole message flows into the printed page instead of being clipped. */
  }

  .attachment,
  .header-card {
    break-inside: avoid;
  }
}
```

- [ ] **Step 2: Link the print stylesheet**

In `src/viewer/viewer.html`, add below the existing stylesheet link:

```html
    <link rel="stylesheet" href="./styles/print.css" media="print" />
```

- [ ] **Step 3: Rebuild and confirm the build test still passes**

Run: `npm run build && npm test`
Expected: build succeeds, all suites green.

- [ ] **Step 4: Write `README.md`**

````markdown
# EML Preview

A Chrome extension that renders `.eml` email files locally in the browser.
Nothing is uploaded anywhere.

## Install

```bash
npm install
npm run build
```

Then open `chrome://extensions`, enable **Developer mode**, click **Load
unpacked**, and select the `dist/` directory.

To preview `.eml` files from your disk, click **Details** on the extension and
turn on **Allow access to file URLs**. Chrome requires this to be set by hand;
an extension cannot request it.

## Usage

- Double-click or open a local `.eml` file in Chrome.
- Click an `.eml` link on the web.
- Click the extension icon and drop a file in.

## Design

- Remote images are blocked on first render and load only when you click
  **Load remote content**. Inline (`cid:`) images always render, since they are
  embedded in the file.
- Message HTML is sanitized with DOMPurify and rendered in an opaque-origin
  sandboxed iframe under a nonce-based CSP. It cannot reach the viewer page,
  your cookies, or your storage.
- Authentication headers (DKIM, SPF, `Authentication-Results`) are shown
  verbatim in the **Headers** tab. They are displayed, not verified.

## Known limits

- Only single-message `.eml`. No `.mbox`, `.pst`, or Outlook `.msg`.
- Download interception occasionally catches an `.eml` you meant to save. Use
  **Download original** in the viewer to save it.
- A nested `.eml` attachment opens in place, replacing the current view.

## Development

```bash
npm run watch   # rebuild on change
npm test        # vitest
```
````

- [ ] **Step 5: Manual verification in Chrome**

Rebuild, reload the unpacked extension, and walk this list. Every item must pass.

1. **Manual upload** — click the extension icon, drop `test/fixtures/multipart-alternative.eml`. Header card shows "Alternative parts"; HTML tab is active and shows "HTML version."; Text tab shows "Plain version."
2. **Remote blocking** — open `test/fixtures/hostile.eml`. Banner reads "1 remote resource blocked". Body shows "Visible text." and no alert fires. Open DevTools; the console shows no script execution from the message.
3. **Load remote content** — click the banner button. The banner disappears and the image element attempts to load (it will 404 — `tracker.example.com` is not real; that is expected).
4. **Inline images** — open `test/fixtures/multipart-related-cid.eml`. The 1×1 logo renders; no banner appears.
5. **Attachments** — open `test/fixtures/with-attachment.eml`. The strip shows `report.txt · text/plain · 12 B`. Click Download; the file saves and contains `hello report`.
6. **Nested message** — open `test/fixtures/nested-rfc822.eml`. Click **Open** on `original.eml`. The view switches to "Original subject".
7. **Charsets** — open `quoted-printable-latin1.eml` (shows `Café au lait`) and `base64-shiftjis.eml` (shows `テスト`).
8. **Encoded words** — open `encoded-word.eml`. From reads `José García <jose@example.com>`, subject reads `Subject with ✓`.
9. **Truncated** — open `truncated.eml`. The partial body renders; no blank page.
10. **Local file navigation** — with **Allow access to file URLs** on, paste `file:///<abs-path>/test/fixtures/html-only.eml` into the address bar. The viewer opens instead of a download.
11. **File access off** — turn the toggle off, reload, retry step 10. The error card explains how to enable it.
12. **Download interception** — serve the fixtures locally with `npx serve test/fixtures` and click a `.eml` link. The viewer opens instead of the file downloading. Grant the host permission when prompted.
13. **Print** — with a message open, press Cmd+P. The preview shows the full message body with no clipping, and no toolbar, tab bar, or banner.
14. **Download original** — click it. The saved file is byte-identical to the fixture (`diff` them).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add print stylesheet and README"
```

---

## Post-Implementation

Run the full suite one last time and confirm the extension loads clean:

```bash
npm run build && npm test
```

Then reload the unpacked extension and check `chrome://extensions` shows no
errors on the EML Preview card.
