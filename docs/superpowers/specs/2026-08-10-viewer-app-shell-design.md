# Viewer App Shell — Layout Redesign

**Date:** 2026-08-10
**Status:** Approved
**Supersedes:** the viewer layout described in `2026-08-10-eml-preview-design.md`
(that document's parsing, sanitization, and interception design is unchanged).

## Problem

The viewer stacks every region into one 900px document column: toolbar, header
card, tab bar, banner, body iframe, attachments. The message body — the reason
the page exists — is the least prominent thing on it. It starts at
`min-height: 200px`, competes for width with metadata it does not need to sit
beside, and grows the page rather than owning a region of the window.

On a wide monitor the result reads as a form, not a mail viewer.

## Goals

- Make the message body the dominant region: full remaining width and height.
- Give metadata and attachments a home that does not push the body down.
- Keep every existing capability: four tabs, remote-content banner, print/PDF,
  download original, nested `.eml`, drop zone, error cards.
- Stay on the current neutral/system palette. This is a structural change, not a
  new visual identity.

## Non-Goals

- New features. No search, no message list, no settings.
- A reading-measure cap on the body. HTML email fills the pane at full width;
  senders control their own layout.
- Changing parsing, sanitization, the sandbox, or the CSP.

## Layout

`#app` becomes a viewport-locked CSS grid.

```
┌────────────────────────────────────────────────────────────┐
│ ✉ Quarterly report — final      [Print] [Download] [Details]│  appbar
├──────────────────────────────────┬─────────────────────────┤
│ HTML | Text | Raw | Headers      │  DETAILS            [×]  │
├──────────────────────────────────┤  From  Ana Ruiz          │
│ ⚠ 3 remote resources blocked     │        ana@corp.com      │
├──────────────────────────────────┤  To    me@corp.com       │
│                                  │  Date  10 Aug, 14:22     │
│        M E S S A G E   B O D Y   │                          │
│        (fills the pane,          │  ATTACHMENTS (2)         │
│         scrolls internally)      │  ┌─────────────────────┐ │
│                                  │  │ q3.pdf   1.2 MB   ⬇ │ │
│                                  │  ├─────────────────────┤ │
│                                  │  │ notes.eml  8 KB   ↗ │ │
│                                  │  └─────────────────────┘ │
└──────────────────────────────────┴─────────────────────────┘
   main                                rail
```

```css
#app {
  height: 100dvh;
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--rail-w);
  grid-template-rows: auto minmax(0, 1fr);
  grid-template-areas:
    'appbar appbar'
    'main   rail';
}
```

- **appbar** — mail glyph, subject (single line, ellipsis, full text in `title`),
  and right-aligned actions: *Print / Save as PDF*, *Download original*, and a
  *Details* toggle for the rail.
- **main** — a flex column holding the tab bar, the remote-content banner, and
  the pane. The pane is `flex: 1; min-height: 0` so it absorbs leftover height.
- **rail** — an `<aside>` with two sections, Details and Attachments, and a close
  button. Fixed width `--rail-w: 320px`. Scrolls independently when long.

`min-height: 0` on the pane and `minmax(0, 1fr)` on the grid track are load
bearing: without them a tall iframe forces the grid to overflow the viewport
instead of constraining the pane.

### Empty and error states

The drop zone and error cards do not get the shell. `viewer.js` sets
`#app.app--empty`, which collapses the grid to a single centered area, and those
components render unchanged.

### Responsive

Below 900px the rail leaves the grid flow and becomes an off-canvas drawer
positioned over the body, driven by the same *Details* toggle. The shell stays
viewport-locked at every width; only the rail's presentation changes.

## Components

`viewer.js` stops appending a flat list of nodes into `#app`. It builds the shell
once and fills named slots.

| File | Change |
| --- | --- |
| `src/viewer/ui/shell.js` | **New.** Builds the grid skeleton and returns `{ root, appbar, tabs, banner, pane, rail }` slot elements. Owns no message knowledge. |
| `src/viewer/ui/app-bar.js` | **New**, replaces `toolbar.js`. Renders the subject and the three actions, and reflects rail state via `aria-expanded` on the toggle. |
| `src/viewer/ui/toolbar.js` | **Deleted.** Its name stops being true once the region owns the subject. |
| `src/viewer/ui/header-card.js` | Subject moves to the app bar. This becomes the rail's Details block; From/To/Cc/Date rows are unchanged. |
| `src/viewer/ui/attachments.js` | Logic unchanged. Restyled as a rail section. |
| `tabs.js`, `banner.js`, `error-card.js`, `dropzone.js` | Untouched. |

State gains one field, `railOpen`, defaulting to open on wide viewports and
closed under 900px.

## Iframe height

Today the frame reports its content height over `postMessage` and `viewer.js`
sets `frame.style.height`, growing the page. In the new shell the frame is
`height: 100%` of the pane and scrolls internally, so that assignment must stop —
otherwise the reported height fights the grid.

The listener stays, and writes the reported height to a custom property instead:

```js
state.frame.style.setProperty('--content-height', `${event.data.height}px`);
```

Screen CSS keeps `.body-frame { height: 100% }`. Print CSS consumes
`--content-height`, so the whole message still flows into the printed page.

## Print

`src/styles/print.css` gains:

- `#app { display: block; height: auto; }` — unlock the grid back to document flow.
- `.body-frame { height: var(--content-height); }` — restore the full-height frame.
- The rail prints as a block after the body; its close button and the *Details*
  toggle are hidden alongside the existing hidden chrome.

Existing print rules (hide toolbar/tabbar/banner/dropzone, `break-inside: avoid`)
carry over, retargeted at the new class names.

## Styling

The palette is unchanged: `Canvas` / `CanvasText` / `color-mix` tokens, light and
dark adaptive. One token is added, `--surface`, a slight tint of `Canvas`, used
to separate chrome (appbar, tab strip, rail) from the white body region so the
body reads as the content and everything else as frame.

## Testing

New:

- `test/shell.test.js` — the skeleton exposes every slot, and slots are distinct
  elements inside `root`.
- `test/app-bar.test.js` — subject renders (with the `(no subject)` placeholder
  and escaping cases moved over from `header-card.test.js`), all three actions
  fire their handlers, and the toggle reflects `aria-expanded`.

Changed:

- `test/toolbar.test.js` — deleted with the module.
- `test/header-card.test.js` — subject assertions removed; address and date
  assertions stay.
- `test/viewer-integration.test.js` — `.header-card__subject` and `.toolbar`
  selectors repoint at the app bar; a case asserts attachments render inside the
  rail rather than after the body.

Unchanged: every `src/lib/` test. This redesign does not touch parsing,
sanitization, remote blocking, `cid:` inlining, or srcdoc construction.

## Trade-offs accepted

- **`toolbar.js` is deleted rather than widened.** Keeping the name while the
  module owns the subject would mislead. The tests move with the behaviour.
- **`100dvh` removes page-level scrolling.** Each pane scrolls on its own, so a
  single Ctrl-F can no longer sweep the body and the header table together. For a
  viewer whose job is displaying one message, a body that owns the window is
  worth more than cross-region find.
