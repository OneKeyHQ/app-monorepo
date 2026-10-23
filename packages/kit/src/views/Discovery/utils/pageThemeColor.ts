import { useSyncExternalStore } from 'react';

// Per-tab page color, reported by the page itself (see PAGE_THEME_COLOR_SCRIPT)
// so the mobile browser chrome can tint itself like Safari: a dark page gets a
// dark header, status bar and bottom bar.

export const PAGE_THEME_MESSAGE_TYPE = '$onekeyPageThemeColor';

const colors = new Map<string, string>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Accept only opaque rgb()/rgba() values (the script normalizes to these), so
// a page can't feed arbitrary strings into native styles.
const RGB_PATTERN =
  /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)$/;

function parseRgb(color: string) {
  const match = RGB_PATTERN.exec(color.trim());
  if (!match) {
    return undefined;
  }
  const [r, g, b] = [match[1], match[2], match[3]].map(Number);
  const alpha = match[4] === undefined ? 1 : Number(match[4]);
  if ([r, g, b].some((v) => v > 255) || !(alpha >= 0.95)) {
    return undefined;
  }
  return { r, g, b };
}

export function setPageThemeColor(tabId: string, color: string | undefined) {
  const rgb = color ? parseRgb(color) : undefined;
  const next = rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : undefined;
  if (colors.get(tabId) === next) {
    return;
  }
  if (next) {
    colors.set(tabId, next);
  } else {
    colors.delete(tabId);
  }
  emit();
}

export function usePageThemeColor(tabId: string | null | undefined) {
  return useSyncExternalStore(
    subscribe,
    () => (tabId ? colors.get(tabId) : undefined),
    () => undefined,
  );
}

// Relative luminance below the midpoint reads as a dark page.
export function isDarkColor(color: string) {
  const rgb = parseRgb(color);
  if (!rgb) {
    return false;
  }
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance < 0.5;
}

export function tryDispatchPageThemeMessage(tabId: string, data: string) {
  if (!data || !data.includes(PAGE_THEME_MESSAGE_TYPE)) {
    return false;
  }
  try {
    const message = JSON.parse(data) as { type?: string; color?: unknown };
    if (message?.type !== PAGE_THEME_MESSAGE_TYPE) {
      return false;
    }
    setPageThemeColor(
      tabId,
      typeof message.color === 'string' ? message.color : undefined,
    );
    return true;
  } catch {
    return false;
  }
}

// Reports the page color the way Safari 26 tints its chrome: the background
// behind the top of the viewport (a fixed header, else body/html). Safari 26
// no longer uses <meta name="theme-color">; it is only a last fallback here.
// Re-reads after a short delay (late SPA paint) and when the system color
// scheme changes.
export const PAGE_THEME_COLOR_SCRIPT = `(function () {
  try {
    if (window.__onekeyReadPageTheme) {
      window.__onekeyReadPageTheme();
      return;
    }
    var toRgb = function (value) {
      if (!value || !document.body) return '';
      var probe = document.createElement('div');
      probe.style.display = 'none';
      probe.style.color = value;
      document.body.appendChild(probe);
      var rgb = getComputedStyle(probe).color;
      probe.remove();
      return rgb;
    };
    var backgroundOf = function (el) {
      while (el && el.nodeType === 1) {
        var bg = getComputedStyle(el).backgroundColor;
        if (bg && bg !== 'transparent' && !/rgba\\(.*,\\s*0\\)$/.test(bg)) {
          return bg;
        }
        el = el.parentElement;
      }
      return '';
    };
    var read = function () {
      var color =
        backgroundOf(document.elementFromPoint(window.innerWidth / 2, 2)) ||
        backgroundOf(document.body) ||
        backgroundOf(document.documentElement);
      if (!color) {
        var metas = document.querySelectorAll('meta[name="theme-color"]');
        for (var i = 0; i < metas.length; i++) {
          var media = metas[i].getAttribute('media');
          if (!media || window.matchMedia(media).matches) {
            color = toRgb(metas[i].getAttribute('content'));
            break;
          }
        }
      }
      window.ReactNativeWebView &&
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ type: '${PAGE_THEME_MESSAGE_TYPE}', color: color }),
        );
    };
    window.__onekeyReadPageTheme = read;
    read();
    setTimeout(read, 800);
    var scheme = window.matchMedia('(prefers-color-scheme: dark)');
    scheme.addEventListener && scheme.addEventListener('change', read);
  } catch (e) {}
})();
true;`;
