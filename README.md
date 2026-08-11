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
- PDF attachments get a **Preview** action that opens them in a new tab using
  Chrome's built-in PDF viewer. The bytes come from a blob URL, so the file never
  leaves the browser. PDFs mislabelled `application/octet-stream` are detected by
  their `%PDF-` header and previewed too.
- Authentication headers (DKIM, SPF, `Authentication-Results`) are shown
  verbatim in the **Headers** tab. They are displayed, not verified.
- The **Structure** tab shows the real MIME tree — nesting, encodings, charsets
  and per-part sizes — recovered by walking the raw source.
- The **Security** tab summarises SPF/DKIM/DMARC as reported by the receiving
  server, the `Received:` delivery path with per-hop latency, every outbound
  link whose text disagrees with its destination, and the remote resources that
  were blocked (calling out invisible tracking pixels). The tab carries a dot
  when any of that needs attention.
- Attachments are checked for executable and double extensions (`invoice.pdf.exe`)
  and for bytes that contradict the declared type. SHA-256 is computed on demand.
- Calendar invites (`text/calendar`) render as an event card with organiser,
  attendees and their responses, plus a `.ics` download.
- Signed and encrypted messages (S/MIME, PGP) are detected and labelled. Nothing
  is decrypted or cryptographically verified locally.

## Keyboard

`1`–`6` switch panes · `/` or `Ctrl/Cmd-F` find in message · `d` download
original · `i` toggle the details rail · `Esc` close find.

Find is relayed into the message body over `postMessage`, because the body
renders in an opaque origin the viewer deliberately cannot reach into.

## Known limits

- Only single-message `.eml`. No `.mbox`, `.pst`, or Outlook `.msg`.
- Download interception occasionally catches an `.eml` you meant to save. Use
  **Download original** in the viewer to save it.
- Clicking an `.eml` that already sits in Chrome's downloads list will not open
  the viewer. Chrome hands that click to the operating system, and no extension
  API observes it — `chrome.downloads` has no event for a user opening a
  completed download. The extension instead catches `.eml` downloads before they
  land, at both `onCreated` and `onDeterminingFilename`. For a file already on
  disk, drag it into the viewer or open its `file://` URL in a tab.
- No printing or PDF export. Chrome's own print of a sandboxed cross-origin
  frame clipped long messages, so the feature was removed rather than shipped
  broken.
- A nested `.eml` attachment opens in place, replacing the current view.

## Packaging

```bash
npm run package   # builds, then writes release/eml-preview-<version>.zip
```

That zip is the **Chrome Web Store** upload artifact — the store takes a plain
zip with `manifest.json` at its root, not a `.crx`. Publishing needs a one-time
$5 developer registration; a listing can be Public, Unlisted, or restricted to
named trusted testers.

### About "Pack extension" and .crx

The **Pack extension** button on `chrome://extensions` (or
`chrome --pack-extension=dist --pack-extension-key=key.pem`) produces a signed
`.crx` plus a `.pem` private key. Keep the `.pem` — repacking without it changes
the extension ID.

A `.crx` is only useful for self-hosting, and Chrome refuses to install
self-hosted extensions on macOS and Windows: dragging one onto
`chrome://extensions` fails with "can only be added from the Chrome Web Store."
It works only when pushed by enterprise policy (`ExtensionSettings` with an
update URL), or on Linux.

For everyday use, **Load unpacked** on `dist/` is the practical route.

## Development

```bash
npm run watch   # rebuild on change
npm test        # vitest
```

Design and implementation notes live in `docs/superpowers/`. Store listing copy,
permission justifications and screenshots live in `docs/store-listing.md`;
regenerate the screenshots with `node scripts/screenshots.mjs`.

## Privacy

Nothing leaves your device. See [PRIVACY.md](PRIVACY.md).

Published policy URL (for the Chrome Web Store listing):
<https://github.com/mumairofficial/chrome-email-preview/blob/main/PRIVACY.md>

## Licence

ISC — see [LICENSE](LICENSE).
