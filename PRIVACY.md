# Privacy Policy — EML Preview

**Last updated:** 11 August 2026

## The short version

EML Preview does not collect, transmit, store, or sell any data. Everything it
does happens inside your browser, on your device.

## What the extension handles

To show you an email, the extension reads the `.eml` file you open — its
headers, its body, and its attachments. That content is parsed and rendered in
memory, in the tab you are looking at. It is discarded when you close the tab.

## What leaves your device

Nothing, unless you ask for it.

- The extension makes **no** analytics, telemetry, crash-reporting, or
  advertising requests. It contains no third-party SDKs of that kind.
- Message content is **never** uploaded to any server, including the author's.
- Remote images and other remote resources referenced by a message are
  **blocked by default**. They load only after you click **Load remote
  content**, and when you do, the request goes directly from your browser to
  whatever server the message names — exactly as it would in any mail client.
  This is also why the extension blocks them: a remote image can tell the sender
  that you opened the message.
- Clicking a link in a message navigates your browser to that link, as normal.

## Storage

The extension stores nothing. It does not use `chrome.storage`, cookies,
`localStorage`, or IndexedDB. It keeps no history of the messages you have
opened.

## Permissions and why they exist

| Permission | Why |
| --- | --- |
| `webNavigation` | To notice when you navigate to an `.eml` file so the viewer can open instead of a download. |
| `downloads` | To catch an `.eml` arriving as a download and show it instead. Also used to cancel that download so you do not get a stray file. |
| `file:///*` | To read `.eml` files you open from your own disk. Requires you to additionally enable "Allow access to file URLs" by hand. |
| `*://*/*` (optional) | Only requested, per-site and only when you confirm, if you open an `.eml` hosted on a website. Never granted in advance. |

## Data sold or transferred to third parties

None. There is no third party.

## Changes

If this policy changes, the updated version will be published in the
extension's repository and the "last updated" date above will change.

## Contact

Questions about this policy can be raised as an issue in the project
repository.
