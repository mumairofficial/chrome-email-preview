# Chrome Web Store listing

Copy for the developer dashboard. Keep this in sync with `src/manifest.json`
and `PRIVACY.md`.

## Basics

- **Name:** EML Preview
- **Version:** 1.0.0
- **Category:** Productivity
- **Language:** English (UK)
- **Privacy policy URL:** https://github.com/mumairofficial/chrome-email-preview/blob/main/PRIVACY.md
- **Homepage URL:** https://github.com/mumairofficial/chrome-email-preview

## Short description (132 char limit)

> Preview .eml email files directly in Chrome, without uploading them anywhere.

77 characters.

## Detailed description

> Open `.eml` email files straight in Chrome. Double-click one on your disk,
> click one on the web, or drop one onto the viewer — it renders immediately,
> and nothing is ever uploaded.
>
> Everything happens locally in your browser. There are no servers, no
> analytics, and no account.
>
> **Reading**
> • Faithful HTML rendering, including inline (cid:) images
> • Plain-text alternative, raw source, and the full header list
> • Attachments with one-click download, and in-browser preview for PDFs,
>   images and text
> • Calendar invites shown as a readable event card with organiser, attendees
>   and their responses
> • Nested .eml attachments open in place
>
> **Inspecting**
> • Structure — the real MIME tree, with nesting, encodings, charsets and
>   per-part sizes
> • Security — SPF/DKIM/DMARC as reported by the receiving server, the delivery
>   path with per-hop latency, links whose text disagrees with their
>   destination, and the remote resources that were blocked
>
> **Staying safe**
> • Remote images are blocked until you ask for them, so senders cannot tell
>   that you opened a message
> • Invisible tracking pixels are called out by name
> • Message HTML is sanitised and rendered in a sandboxed frame that cannot
>   reach your browser, your cookies or the extension
> • Attachments are checked for executable and disguised double extensions
>   (invoice.pdf.exe) and for bytes that contradict their declared type
> • SHA-256 of any attachment, computed on demand
>
> Keyboard: 1–6 switch panes, / or Ctrl-F to find, d to download, i to toggle
> details.
>
> Known limitation: download interception occasionally catches an .eml you
> meant to save. Use "Download original" in the viewer to get the file.

## Permission justifications

Paste these into the dashboard's justification fields.

**webNavigation**
> Used to detect when the user navigates to a `.eml` file so the extension can
> open its local viewer instead of letting Chrome download the file. The
> extension only reads the URL of the top-level navigation and acts when it
> ends in `.eml`.

**downloads**
> Used to detect a `.eml` file arriving as a download and open it in the
> viewer instead. The extension cancels and erases that specific download so
> the user is not left with a stray file they did not want.

**Host permission `file:///*`**
> Required to read `.eml` files the user opens from their own disk. No file is
> read unless the user navigates to it. Chrome additionally requires the user
> to enable "Allow access to file URLs" manually, which an extension cannot do
> for them.

**Optional host permission `*://*/*`**
> Requested at runtime, per site, and only when the user opens a `.eml` file
> hosted on a website. It is optional and never granted in advance; the
> extension asks for the single origin of the file being opened. It is used
> solely to fetch that file's bytes.

**Remote code**
> The extension executes no remote code. All scripts are bundled in the
> package. Message HTML is sanitised with DOMPurify and rendered inside a
> sandboxed iframe with a nonce-based Content-Security-Policy and no
> `allow-same-origin`.

## Data-use disclosures

Tick **Personal communications** (the extension handles the content of the
email files the user opens). Then certify all three:

- Not being sold to third parties
- Not being used or transferred for purposes unrelated to the item's single purpose
- Not being used or transferred to determine creditworthiness or for lending

The extension transmits nothing off-device, so all three hold.

## Screenshots

Generated at 1280×800 into `docs/screenshots/`. At least one is required; up to
five are allowed.

| File | Shows |
| --- | --- |
| `01-message.png` | A rendered message with the details rail and an invite card |
| `02-security.png` | The Security pane: auth chips, delivery path, disguised link, tracking pixel |
| `03-structure.png` | The Structure pane: the MIME tree |
| `04-home.png` | The drop-zone home screen |

Regenerate with `node scripts/screenshots.mjs` (needs Chrome installed and the
extension built).
