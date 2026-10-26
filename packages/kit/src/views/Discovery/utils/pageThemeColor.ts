import { useSyncExternalStore } from 'react';

import { LRUCache } from '@onekeyhq/shared/src/utils/cacheUtils';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

// Per-tab page color, reported by the page itself (see PAGE_THEME_COLOR_SCRIPT)
// so the mobile browser chrome can tint itself like Safari: a dark page gets a
// dark header, status bar and bottom bar.

const PAGE_THEME_MESSAGE_TYPE = '$onekeyPageThemeColor';

const colors = new Map<string, string>();
// Per-tab base background (body/html), the color past the end of the page:
// it fills the area under the mobile browser's bottom bar (the iPhone page
// backdrop in Browser.native, else the bar's strip).
const baseColors = new Map<string, string>();
// Last color seen per origin (this session), so a revisited site tints the
// chrome as soon as it starts loading instead of after its first report.
const originColors = new LRUCache<string, string>({ max: 100 });

function originOf(url: string | undefined) {
  return url ? uriUtils.safeParseURL(url)?.origin : undefined;
}
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

// Below this alpha a color counts as translucent: rejected here, and skipped
// by the page script (e.g. a modal's dimming backdrop).
const MIN_OPAQUE_ALPHA = 0.95;

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
  if ([r, g, b].some((v) => v > 255) || !(alpha >= MIN_OPAQUE_ALPHA)) {
    return undefined;
  }
  return { r, g, b };
}

function normalizeColor(color: unknown) {
  const rgb = typeof color === 'string' ? parseRgb(color) : undefined;
  return rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : undefined;
}

// Returns whether the map changed.
function storeColor(
  map: Map<string, string>,
  tabId: string,
  color: string | undefined,
) {
  if (map.get(tabId) === color) {
    return false;
  }
  if (color) {
    map.set(tabId, color);
  } else {
    map.delete(tabId);
  }
  return true;
}

// Stores both colors (already normalized), notifying once if either changed.
function setPageColors(
  tabId: string,
  color: string | undefined,
  baseColor: string | undefined,
) {
  const colorChanged = storeColor(colors, tabId, color);
  const baseChanged = storeColor(baseColors, tabId, baseColor);
  if (colorChanged || baseChanged) {
    emit();
  }
}

export function clearPageColors(tabId: string) {
  setPageColors(tabId, undefined, undefined);
}

function usePageThemeColor(tabId: string | null | undefined) {
  return useSyncExternalStore(
    subscribe,
    () => (tabId ? colors.get(tabId) : undefined),
    () => undefined,
  );
}

// The page's base background, else its chrome color.
export function usePageBaseColor(tabId: string | null | undefined) {
  return useSyncExternalStore(
    subscribe,
    () => (tabId ? (baseColors.get(tabId) ?? colors.get(tabId)) : undefined),
    () => undefined,
  );
}

// Relative luminance below the midpoint reads as a dark page.
function isDarkColor(color: string) {
  const rgb = parseRgb(color);
  if (!rgb) {
    return false;
  }
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance < 0.5;
}

// The page's color and the light/dark theme the chrome should use on top of
// it; no page color means the chrome keeps the app theme.
export function usePageTheme(tabId: string | null | undefined) {
  const pageColor = usePageThemeColor(tabId);
  let pageThemeName: 'light' | 'dark' | undefined;
  if (pageColor) {
    pageThemeName = isDarkColor(pageColor) ? 'dark' : 'light';
  }
  return { pageColor, pageThemeName };
}

// Applies the cached color of the page's origin, if any; otherwise the
// current tint stays until the page reports its own.
export function applyCachedPageThemeColor(tabId: string, url: string) {
  const origin = originOf(url);
  const cached = origin ? originColors.get(origin) : undefined;
  if (cached && storeColor(colors, tabId, cached)) {
    emit();
  }
}

export function tryDispatchPageThemeMessage(
  tabId: string,
  data: string,
  pageUrl?: string,
) {
  if (!data || !data.includes(PAGE_THEME_MESSAGE_TYPE)) {
    return false;
  }
  try {
    const message = JSON.parse(data) as {
      type?: string;
      color?: unknown;
      baseColor?: unknown;
    };
    if (message?.type !== PAGE_THEME_MESSAGE_TYPE) {
      return false;
    }
    const color = normalizeColor(message.color);
    setPageColors(tabId, color, normalizeColor(message.baseColor));
    const origin = originOf(pageUrl);
    if (origin) {
      // A page that reports no color also drops its stale cache, so the next
      // visit doesn't open on an old tint.
      if (color) {
        originColors.set(origin, color);
      } else {
        originColors.delete(origin);
      }
    }
    return true;
  } catch {
    return false;
  }
}

// Reports the page color the way Safari 26 tints its chrome: the background
// behind the top of the viewport (a fixed header, else body/html). Safari 26
// no longer uses <meta name="theme-color">; it is only a last fallback here.
// Also reports the base background (body/html), which can differ from the
// top (e.g. a colored banner over a gray page).
// Re-reads after a short delay (late SPA paint), when the system color scheme
// changes, and when the page switches its own theme (class/style/data-*
// changes on <html>/<body>, or a new theme-color), like Safari tracking a
// site's light/dark toggle.
export const PAGE_THEME_COLOR_SCRIPT = `(function () {
  try {
    if (window.__onekeyReadPageTheme) {
      window.__onekeyReadPageTheme();
      return;
    }
    // Any CSS color as rgba(): computed styles keep modern color spaces
    // (oklch(), color(), e.g. Tailwind v4), which the app side can't parse,
    // so those are drawn on a 1px canvas and read back. An unparsable value
    // leaves the transparent fill and reads as no color.
    var ctx;
    var toRgb = function (value) {
      if (!value || value === 'transparent') return '';
      if (/^rgba?\\(/.test(value)) return value;
      try {
        if (!ctx) {
          var canvas = document.createElement('canvas');
          canvas.width = 1;
          canvas.height = 1;
          ctx = canvas.getContext('2d', { willReadFrequently: true });
        }
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        ctx.fillStyle = value;
        ctx.fillRect(0, 0, 1, 1);
        var d = ctx.getImageData(0, 0, 1, 1).data;
        return 'rgba(' + d[0] + ', ' + d[1] + ', ' + d[2] + ', ' + d[3] / 255 + ')';
      } catch (e) {
        return '';
      }
    };
    // Opaque backgrounds only: translucent layers (e.g. a modal's dimming
    // backdrop) are skipped so the page's own color shows through.
    var isOpaque = function (bg) {
      if (!bg || bg === 'transparent') return false;
      var m = /rgba\\([^,]+,[^,]+,[^,]+,\\s*([\\d.]+)\\s*\\)/.exec(bg);
      return !m || parseFloat(m[1]) >= ${MIN_OPAQUE_ALPHA};
    };
    var backgroundOf = function (el) {
      while (el && el.nodeType === 1) {
        var bg = toRgb(getComputedStyle(el).backgroundColor);
        if (isOpaque(bg)) {
          return bg;
        }
        el = el.parentElement;
      }
      return '';
    };
    var lastReport;
    var read = function () {
      // Walks up from <body> to <html>.
      var baseColor = backgroundOf(document.body || document.documentElement);
      var color =
        backgroundOf(document.elementFromPoint(window.innerWidth / 2, 2)) ||
        baseColor;
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
      var report = color + '|' + baseColor;
      if (report === lastReport) return;
      lastReport = report;
      window.ReactNativeWebView &&
        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: '${PAGE_THEME_MESSAGE_TYPE}',
            color: color,
            baseColor: baseColor,
          }),
        );
    };
    // Re-injection (SPA navigation) and restores from the back-forward cache
    // land on a document that already reported: the app may be showing
    // another page's color by now, so report again even if unchanged, and
    // re-read once the new route has painted.
    var refresh = function () {
      lastReport = undefined;
      read();
      setTimeout(read, 800);
    };
    window.__onekeyReadPageTheme = refresh;
    window.addEventListener('pageshow', function (event) {
      if (event.persisted) refresh();
    });
    read();
    setTimeout(read, 800);
    var scheme = window.matchMedia('(prefers-color-scheme: dark)');
    scheme.addEventListener && scheme.addEventListener('change', read);
    // Throttled (at most one read per 300ms, trailing): theme toggles touch
    // several attributes at once and the new colors may land a frame or a
    // transition later, while pages that mutate constantly still get reads.
    var pending;
    var schedule = function () {
      if (pending) return;
      pending = setTimeout(function () {
        pending = null;
        read();
      }, 300);
    };
    var isThemeMeta = function (node) {
      return (
        node &&
        node.nodeName === 'META' &&
        node.getAttribute('name') === 'theme-color'
      );
    };
    if (window.MutationObserver) {
      var attrs = { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-color-mode', 'data-mode'] };
      var observer = new MutationObserver(schedule);
      observer.observe(document.documentElement, attrs);
      document.body && observer.observe(document.body, attrs);
      // <head> churns with style/script tags (CSS-in-JS, SPA routing); only
      // theme-color changes matter there.
      document.head &&
        new MutationObserver(function (mutations) {
          for (var i = 0; i < mutations.length; i++) {
            var m = mutations[i];
            if (isThemeMeta(m.target)) return schedule();
            var nodes = [].concat(
              [].slice.call(m.addedNodes),
              [].slice.call(m.removedNodes),
            );
            for (var j = 0; j < nodes.length; j++) {
              if (isThemeMeta(nodes[j])) return schedule();
            }
          }
        }).observe(document.head, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['content'],
        });
    }
  } catch (e) {}
})();
true;`;
