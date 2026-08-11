const TAB_KEYS = ['1', '2', '3', '4', '5', '6'];

function isTyping(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

// Returns an unbind function so a caller can tear the listener down.
export function bindShortcuts(handlers, target = window) {
  const onKeyDown = (event) => {
    const findCombo = (event.metaKey || event.ctrlKey) && event.key === 'f';

    if (findCombo) {
      event.preventDefault();
      handlers.onFind?.();
      return;
    }

    if (event.metaKey || event.ctrlKey || event.altKey) return;

    if (event.key === 'Escape') {
      handlers.onEscape?.();
      return;
    }

    // Everything below is a bare letter, which must not steal keystrokes from
    // the find field.
    if (isTyping(event.target)) return;

    const index = TAB_KEYS.indexOf(event.key);
    if (index !== -1) {
      event.preventDefault();
      handlers.onTab?.(index);
      return;
    }

    switch (event.key) {
      case '/':
        event.preventDefault();
        handlers.onFind?.();
        break;
      case 'd':
        event.preventDefault();
        handlers.onDownload?.();
        break;
      case 'i':
        event.preventDefault();
        handlers.onToggleRail?.();
        break;
      case '?':
        event.preventDefault();
        handlers.onHelp?.();
        break;
      default:
        break;
    }
  };

  target.addEventListener('keydown', onKeyDown);
  return () => target.removeEventListener('keydown', onKeyDown);
}
