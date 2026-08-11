# EML Preview — Chrome Extension Design

**Date:** 2026-08-10
**Status:** Approved

## Problem

Chrome has no native renderer for `message/rfc822`. Opening an `.eml` file — from
disk, from a web link, or as a download — always produces a download, never a
preview. Reading one means opening a desktop mail client or a third-party web
service, which is slow and, for anything sensitive, means handing the message to
someone else's server.

This extension renders `.eml` files locally in the browser, with fidelity for
HTML multipart mail, and without leaking that the message was opened.

## Goals

- Render HTML multipart email faithfully, including inline (`cid:`) images.
- Work from three entry points: local files, web links/downloads, manual upload.
- Block remote content by default; load it on explicit user action.
- Expose attachments, plain-text alternative, raw source, and full headers.
- Print / save as PDF.
- Parse and render entirely client-side. No network calls except those the user
  explicitly triggers.

## Non-Goals

- Composing, replying, forwarding, or sending mail.
- Mailbox formats other than single-message `.eml` (no `.mbox`, `.pst`, `.msg`).
- Verifying DKIM/SPF signatures. Authentication headers are *displayed*, not
  *evaluated*.
- Search, tagging, or any persistence across sessions.

## Architecture

Chrome never renders `.eml` as a page, so there is no host document to enhance
with a content script. All three entry points therefore funnel into a single
extension page, `viewer.html`, which is the entire application. The service
worker does nothing but detect and redirect.

```
┌──────────────────────┐
│   service worker     │  webNavigation.onBeforeNavigate  → file:// or http(s) *.eml
│  (interception only) │  downloads.onCreated             → message/rfc822 fallback
└──────────┬───────────┘
           │ tabs.update → viewer.html?src=<encoded url>
           ▼
┌──────────────────────────────────────────────────────────────┐
│                        viewer.html                            │
│                                                               │
│  source-loader ─→ parse-email ─→ EmailModel                   │
│                                     ├─ headers ─→ header card │
│                                     │           └→ inspector  │
│                                     ├─ attachments ─→ strip   │
│                                     └─ html                   │
│                                          ↓ inline-cid         │
│                                          ↓ sanitize-html      │
│                                          ↓ block-remote       │
│                                          ↓ build-srcdoc       │
│                                    sandboxed <iframe>         │
└──────────────────────────────────────────────────────────────┘
```

### Entry points

| Entry | Mechanism |
|---|---|
| Local file | `webNavigation.onBeforeNavigate` matches `file://*.eml` → `tabs.update` to `viewer.html?src=<url>` |
| Web link | Same match on `http(s)://*.eml` |
| Download fallback | `downloads.onCreated` fires for URLs with no `.eml` suffix but MIME `message/rfc822`; cancel the download, open the viewer against the source URL |
| Manual | Extension action opens bare `viewer.html`; drag-drop zone + file picker |

The download fallback exists because content type is not knowable before the
request is made. It carries an accepted cost: a file the user genuinely wanted
saved will occasionally be intercepted. Mitigated by a **Download original**
button always present in the viewer toolbar.

### Permissions

```jsonc
"permissions":          ["webNavigation", "downloads", "tabs"],
"host_permissions":     ["file:///*"],
"optional_host_permissions": ["*://*/*"]
```

`*://*/*` is optional and requested via `chrome.permissions.request()` the first
time the user previews a remote URL, so a user who only ever opens local files
never grants broad web access.

`file:///*` additionally requires the user to enable **Allow access to file
URLs** on the extension's details page. This is a manual, per-extension Chrome
toggle that cannot be requested programmatically. The viewer detects the
resulting fetch failure and renders instructions (see Error Handling).

## Modules

Each `lib` module has one job and a pure signature. The three transforms in the
middle of the pipeline are synchronous string/DOM functions, unit-testable
without Chrome APIs.

```
src/
  manifest.json
  background/
    service-worker.js       interception + redirect only
    intercept-rules.js      URL/MIME matching predicates (pure, testable)
  lib/
    source-loader.js        src → ArrayBuffer   (file://, http(s), File object)
    parse-email.js          ArrayBuffer → EmailModel   (postal-mime wrapper)
    inline-cid.js           html + attachments → html with blob: URLs
    sanitize-html.js        dirty html → safe html     (DOMPurify config)
    block-remote.js         safe html → { html, blockedCount }   (reversible)
    build-srcdoc.js         html + CSP policy → srcdoc string
  viewer/
    viewer.html
    viewer.js               orchestration only
    ui/header-card.js       from/to/cc/subject/date summary
    ui/header-inspector.js  full header table, expandable
    ui/tabs.js              HTML | Text | Raw | Headers
    ui/attachments.js       attachment strip, download, nested .eml
    ui/banner.js            remote-content-blocked banner
    ui/error-card.js        inline failure rendering
  styles/
    viewer.css
    print.css
test/
  fixtures/*.eml
  *.test.js
```

### EmailModel

The shape returned by `parse-email.js`, matching postal-mime's output:

```js
{
  headers: [{ key, value }],          // every header, in file order
  from: { name, address },
  to: [], cc: [], bcc: [], replyTo: [],
  subject, messageId, inReplyTo, references, date,
  html,                               // text/html part, or null
  text,                               // text/plain part, or null
  attachments: [{
    filename, mimeType, disposition,  // 'attachment' | 'inline'
    related,                          // true if referenced by a cid:
    contentId, content                // content is ArrayBuffer
  }]
}
```

## Rendering & Security

Email HTML is hostile input. Two independent layers stop it:

**1. Sanitization.** DOMPurify strips `<script>`, `<iframe>`, `<form>`, `<object>`,
`<embed>`, all `on*` event handlers, and `javascript:` / `data:text/html` URLs.
Inline `style` attributes and `<style>` blocks are preserved — email layout
depends on them — but `position: fixed` and `url()` pointing at remote origins
are removed.

**2. Sandboxed iframe.** The sanitized HTML is injected via `srcdoc` into:

```html
<iframe sandbox="allow-popups allow-popups-to-escape-sandbox allow-scripts">
```

`allow-same-origin` is deliberately **absent**, making the frame an opaque
origin: it cannot read the viewer's DOM, its storage, or any cookie. The
`allow-scripts` grant exists solely for one nonce'd inline script we inject,
which posts the content height back to the viewer for frame sizing and printing.
The srcdoc carries its own CSP meta tag:

```
default-src 'none';
img-src data: blob:;          ← flips to  data: blob: https:  on user action
style-src 'unsafe-inline';
script-src 'nonce-<random>';
```

Because the policy is nonce-based, any script DOMPurify somehow missed still
cannot execute. Sanitization and CSP each independently suffice; together they
are the defense-in-depth requirement.

Links inside the message get `target="_blank"` and `rel="noopener noreferrer"`,
which the popup sandbox grants permit.

### Remote content blocking

After sanitization, `block-remote.js` walks the DOM and rewrites every `http(s)`
image `src` to `data-blocked-src`, strips remote `url()` from styles, and drops
remote `<link>` elements — returning the rewritten HTML plus a count. The count
drives a banner: *"N remote images blocked — Load images"*. Clicking it re-runs
the pipeline with blocking disabled and the relaxed CSP.

`cid:` references are resolved before this step into `blob:` URLs from the
matching inline attachment, so embedded images always render. They are local
bytes and leak nothing.

## Features

**Tabs.** *HTML* (default when an `html` part exists), *Text* (the `text/plain`
alternative, rendered escaped in a `<pre>`), *Raw* (the original RFC 822 bytes,
decoded as text), *Headers* (full header table). Tabs whose content is absent
are disabled, not hidden, so their absence is legible.

**Header card.** Always visible above the tabs: From, To, Cc, Subject, Date.
Long recipient lists collapse behind a "+N more" toggle.

**Header inspector.** The *Headers* tab renders every header in file order,
including the full `Received` chain, `Message-ID`, and
`Authentication-Results` / `DKIM-Signature` / `SPF` values. Displayed verbatim;
no verification is performed and none is implied by the UI.

**Attachments.** Non-inline attachments render as a strip below the body with
filename, MIME type, and human-readable size. Click downloads via a blob URL.
An attachment with MIME `message/rfc822` opens in a new viewer tab instead,
recursively.

**Print / PDF.** A print button applies `print.css`: viewer chrome hidden, the
iframe expanded to its full reported height so no content is clipped, header
card repeated as page context. Remote images print only if the user already
loaded them.

## Error Handling

Every failure renders an inline error card in place of the body, with the raw
source still reachable via the *Raw* tab. A blank page is never an acceptable
outcome.

| Failure | Handling |
|---|---|
| File access blocked | `file://` fetch throws → card explaining the **Allow access to file URLs** toggle, with the path to the extension details page |
| Remote host permission denied | Card offering to re-request the optional permission |
| Fetch failed (404, offline, auth) | Card with the status and the source URL |
| Not a valid email | Parse yields no headers and no body → card saying so; *Raw* tab still shows the bytes |
| Truncated MIME | postal-mime returns partial parts → render what parsed, plus a warning strip |
| Unknown charset | Fall back to UTF-8 with replacement characters, plus a warning strip naming the declared charset |

## Testing

Vitest over a fixture corpus. The four `lib` transforms and the interception
predicates are pure and covered directly; rendering fidelity stays manual.

Fixtures under `test/fixtures/`:

- plain text only
- HTML only
- `multipart/alternative` (text + HTML)
- `multipart/related` with `cid:` inline images
- message with attachments (PDF, image)
- nested `message/rfc822` attachment
- quoted-printable body with ISO-8859-1 charset
- base64 body with Shift_JIS charset
- RFC 2047 encoded-word subject and display names
- hostile: `<script>`, `onerror=`, `javascript:` href, remote tracking pixel
- malformed: truncated mid-boundary

Assertions of note: the hostile fixture must survive `sanitize-html` with zero
script nodes and zero `on*` attributes, and must report exactly one blocked
remote resource from `block-remote`.

## Build

`npm` + esbuild bundles the two runtime dependencies (postal-mime, DOMPurify)
into `dist/`. Versions are pinned in `package-lock.json` rather than vendored as
committed blobs, so updates are auditable.

The build emits bundled JS entry points (`service-worker.js`, `viewer.js`) into
`dist/`, and copies the static assets — `manifest.json`, `viewer.html`, and
`styles/` — across unchanged. `dist/` is the directory loaded as an unpacked
extension and is gitignored. `npm run build` must run before loading;
`npm run watch` for development.

## Accepted Tradeoffs

1. **Download interception may catch files the user wanted saved.** Mitigated by
   the always-present *Download original* button.
2. **`file://` support requires a manual Chrome toggle** that cannot be
   requested programmatically. Mitigated by explicit in-viewer instructions.
3. **A build step is required** before loading unpacked, in exchange for pinned,
   auditable dependencies.
4. **Rendering fidelity is not automatically tested.** Email HTML rendering has
   no meaningful assertion short of screenshot diffing, which is out of scope.
