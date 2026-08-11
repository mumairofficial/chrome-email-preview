# PDF Attachment Preview — Design

**Date:** 2026-08-10
**Status:** Approved

## Problem

Every attachment in the rail offers exactly one action: Download. For a PDF —
the most common thing worth actually looking at in a message — reading it means
saving it to disk and reopening it from the Downloads shelf. Chrome already ships
a PDF viewer; the message just never hands it the file.

## Goals

- A **Preview** action beside Download on PDF attachments, opening the file in
  Chrome's built-in PDF viewer.
- Recognise PDFs that are mislabelled `application/octet-stream`, which is common
  in real mail.
- No manifest, CSP, permission, or parsing change.

## Non-Goals

- Inline or overlay preview inside the shell. Preview opens a new tab.
- Bundling PDF.js. Chrome's viewer is the point.
- Thumbnails, or preview for images, text, or any other attachment type.

## Detection — `src/lib/pdf.js` (new)

```js
export function isPdf(attachment) → boolean
```

- `mimeType === 'application/pdf'` → `true`. The declared type is trusted.
- Otherwise a case-insensitive `.pdf` filename whose content contains the `%PDF-`
  header **within the first 1024 bytes** → `true`.
- Everything else → `false`.

The header is searched rather than checked at offset 0 because the PDF spec
permits leading bytes before it. Attachment `content` is always an `ArrayBuffer`
(`src/lib/parse-email.js:16`), so the scan is a `Uint8Array` view with no copy.

This lives in `src/lib/` rather than inside `attachments.js` because it is
byte-level content classification — the same family as `block-remote.js` and
`inline-cid.js` — and is the piece most worth testing in isolation.

## Opening — `src/viewer/ui/attachments.js`

For an attachment where `isPdf` holds, a Preview anchor is inserted **before** the
existing Download link:

```html
<a href="blob:…" target="_blank" rel="noopener">Preview</a>
```

No `download` attribute, so Chrome navigates instead of saving, sees
`application/pdf`, and hands off to its built-in viewer with the full toolbar.
`rel="noopener"` denies the new tab a handle back to the viewer page. Being a
real link, Cmd-click and middle-click work natively.

### Blob typing

Navigating to an `application/octet-stream` blob downloads it instead of
previewing, so the preview URL is not always the download URL:

| Case | Download link | Preview link |
| --- | --- | --- |
| `mimeType` is `application/pdf` | blob of the declared type | the same URL, reused |
| sniffed `.pdf` under another type | blob of the declared type (unchanged) | a second blob typed `application/pdf` |

Both go through the `createUrl` function `renderAttachments` already accepts, so
tests stay deterministic. Neither is revoked — they live until the viewer tab
closes, which is the contract the existing download URLs already have.

## Styling

The Download link is currently a bare anchor sitting beside a bordered button
(the nested-`.eml` *Open*). A second link makes the mismatch obvious, so
`.attachment a` in `src/styles/viewer.css` picks up the same treatment as
`button`. This is a targeted fix in code the change already touches, not a
general restyle.

## Testing

New:

- `test/pdf.test.js` — declared `application/pdf`; `.pdf` with `%PDF-` at offset
  0; the same at offset 300; `.pdf` with no header; uppercase `.PDF`; header
  bytes under a non-`.pdf` filename; empty content.
- `test/fixtures/with-pdf-attachment.eml` — two parts, one declared
  `application/pdf` and one `application/octet-stream` named `.pdf`, exercising
  both branches through the real parser.

Changed:

- `test/attachments.test.js` — a PDF gets a Preview anchor with `target="_blank"`
  and no `download`, and still gets Download; a non-PDF gets no Preview; the
  sniffed case builds its preview URL from a blob whose `type` is
  `application/pdf`, asserted with a `createUrl` spy.
- `test/viewer-integration.test.js` — the details rail exposes Preview for a PDF
  attachment.

## Risk

That Chrome opens a top-level `blob:chrome-extension://…` navigation in the PDF
viewer rather than downloading it cannot be verified under vitest — it is browser
behaviour, not DOM behaviour. Blob URLs inherit the extension origin and
same-origin navigation is permitted, so it is expected to work, but it needs
confirmation in a loaded extension. If Chrome refuses, the fallback is a small
`web_accessible_resources` page that embeds the PDF in an iframe.
