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

Design and implementation notes live in `docs/superpowers/`.
