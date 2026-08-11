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

## Single purpose

> EML Preview has one purpose: to display the contents of `.eml` email files
> locally in the browser. Every permission below exists to get an `.eml` file in
> front of the user; the extension does nothing else.

## Permission justifications

Paste these into the dashboard's justification fields. Each was checked against
actual API usage — see the audit table at the bottom of this section.

**webNavigation**
> The extension's purpose is to display `.eml` files. Chrome has no renderer for
> `message/rfc822`, so navigating to a `.eml` file downloads it instead of
> showing it. This permission is used for a single listener that inspects the
> URL of top-level navigations and, when one ends in `.eml`, redirects that tab
> to the extension's own viewer page. No page content is read or modified, and
> no other navigation is touched.

**downloads**
> Servers commonly send `.eml` files with `Content-Disposition: attachment`, in
> which case no navigation occurs and webNavigation cannot see them. This
> permission is used for a single listener that detects a download whose MIME
> type is `message/rfc822` or whose filename ends in `.eml`, cancels and erases
> that one download, and opens the file in the extension's viewer instead. It
> is what makes the extension's single purpose work for web-hosted mail.
> Downloads the extension itself initiates (the "Download original" button, a
> `blob:` URL) are explicitly excluded so the user is never trapped in a loop.

**Host permission `file:///*`**
> Required to read the bytes of `.eml` files the user opens from their own disk,
> which is the extension's primary use case. A file is only read after the user
> navigates to it. Chrome additionally requires the user to switch on "Allow
> access to file URLs" by hand, which an extension cannot do on their behalf, so
> this access is never silent.

**Optional host permission `*://*/*`**
> Not granted at install time. When — and only when — the user opens a `.eml`
> file hosted on a website, the extension asks for the single origin of that
> file (for example `https://example.com/*`) via `chrome.permissions.request`,
> and the user must approve the prompt. The broad pattern is declared because
> the origin is not knowable in advance; the extension never requests more than
> the one origin it needs. The permission is used only to fetch that file's
> bytes. The request is made with credentials so that `.eml` files behind a
> login work, exactly as a normal browser request to that site would.

**Remote code**
> None. All scripts are bundled in the package. Message HTML is sanitised with
> DOMPurify and rendered inside a sandboxed iframe with a nonce-based
> Content-Security-Policy and no `allow-same-origin`, so message content cannot
> execute against the extension.

### Audit — declared vs used

| Declared | Used by | Source |
| --- | --- | --- |
| `webNavigation` | `webNavigation.onBeforeNavigate` | `src/background/service-worker.js` |
| `downloads` | `downloads.onCreated`, `.cancel`, `.erase` | `src/background/service-worker.js` |
| `file:///*` | `fetch` of `file:` URLs | `src/lib/source-loader.js` |
| `*://*/*` (optional) | `fetch` of http(s) URLs, requested per-origin | `src/lib/source-loader.js`, `src/viewer/host-permission.js` |

Requiring no permission, and correctly not declared: `tabs.create`, `tabs.update`
(the `tabs` permission only gates `url`/`title`/`favIconUrl`, none of which are
read), `runtime.getURL`, `action.onClicked`, `permissions.*`.

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
