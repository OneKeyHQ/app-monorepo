import { useSyncExternalStore } from 'react';

import { LRUCache } from '@onekeyhq/shared/src/utils/cacheUtils';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

// Per-tab page color, reported by the page itself (see PAGE_THEME_COLOR_SCRIPT)
// so the mobile browser chrome can tint itself like Safari: a dark page gets a
// dark header, status bar and bottom bar.

const PAGE_THEME_MESSAGE_TYPE = '$onekeyPageThemeColor';

const colors = new Map<string, string>();
// Per-tab color at the bottom of the viewport, right above the bottom bar:
// it fills the area under the bar (the iPhone page backdrop in
// Browser.native, else the bar's strip), so the page seems to carry on.
const bottomColors = new Map<string, string>();
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
  bottomColor: string | undefined,
) {
  const colorChanged = storeColor(colors, tabId, color);
  const bottomChanged = storeColor(bottomColors, tabId, bottomColor);
  if (colorChanged || bottomChanged) {
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

// The page's color at the bottom of the viewport, else its chrome color.
export function usePageBottomColor(tabId: string | null | undefined) {
  return useSyncExternalStore(
    subscribe,
    () => (tabId ? (bottomColors.get(tabId) ?? colors.get(tabId)) : undefined),
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
function themeNameOf(color: string | undefined): 'light' | 'dark' | undefined {
  if (!color) {
    return undefined;
  }
  return isDarkColor(color) ? 'dark' : 'light';
}

export function usePageTheme(tabId: string | null | undefined) {
  const pageColor = usePageThemeColor(tabId);
  return { pageColor, pageThemeName: themeNameOf(pageColor) };
}

// The light/dark theme for chrome laid over the bottom of the page (the
// bottom bar), from the color there: a page can be dark at the top and light
// at the bottom, or the other way round.
export function usePageBottomThemeName(tabId: string | null | undefined) {
  return themeNameOf(usePageBottomColor(tabId));
}

// Whether a load-start starts a new document, which is what makes the previous
// page's bottom color stale (see applyCachedPageThemeColor). A load-start
// without a new document is a hash change or, on Android, a same-document
// history update, which the WebView reports with loading === false; the page
// keeps its colors and does not report them again.
export function isNewDocumentLoad({
  url,
  previousDocumentUrl,
  loading,
  isAndroid,
}: {
  url: string;
  previousDocumentUrl: string;
  loading?: boolean;
  isAndroid: boolean;
}) {
  if (isAndroid && loading === false) {
    return false;
  }
  return documentUrlOf(url) !== previousDocumentUrl;
}

// The URL without its hash, so an anchor jump reads as the same document.
export function documentUrlOf(url: string) {
  return url.split('#')[0];
}

// Applies the cached color of the page's origin, if any; otherwise the
// current tint stays until the page reports its own. A new document also drops
// the bottom color: it described the page being left, the bar picks its icon
// and glass theme from it, and keeping it would leave the controls on the
// wrong contrast until the destination reports. A same-document navigation
// (anchor link, hash routing, Android's history update, which also arrives as
// load-start) changes nothing at all: the document keeps both colors, and
// applying the origin's cache here could replace them with another tab's, as
// the cache is shared per origin and this page would not report again.
export function applyCachedPageThemeColor(
  tabId: string,
  url: string,
  isNewDocument = true,
) {
  if (!isNewDocument) {
    return;
  }
  const origin = originOf(url);
  const cached = origin ? originColors.get(origin) : undefined;
  const colorChanged = cached ? storeColor(colors, tabId, cached) : false;
  const bottomChanged = storeColor(bottomColors, tabId, undefined);
  if (colorChanged || bottomChanged) {
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
      bottomColor?: unknown;
    };
    if (message?.type !== PAGE_THEME_MESSAGE_TYPE) {
      return false;
    }
    const color = normalizeColor(message.color);
    setPageColors(tabId, color, normalizeColor(message.bottomColor));
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
// Also reports the background behind the bottom of the viewport, which can
// differ from the top (a colored banner over a gray page) and from body/html
// (app-like sites paint a dark container over a white body); it follows
// scrolling, so a sheet at the bottom brings its own color.
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
    // Canvas conversions cached per value: a page has only a few distinct
    // backgrounds, and each read checks several of them.
    var rgbCache = {};
    var toRgb = function (value) {
      if (!value || value === 'transparent') return '';
      if (/^rgba?\\(/.test(value)) return value;
      if (rgbCache[value] !== undefined) return rgbCache[value];
      rgbCache[value] = canvasRgb(value);
      return rgbCache[value];
    };
    var canvasRgb = function (value) {
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
    // The color seen at a point: the stacked backgrounds there, from the top
    // one down to the first opaque one, translucent layers blended over it
    // (a frosted bottom nav over a white body reads dark, a dimming backdrop
    // over the page reads as the dimmed page).
    var colorAt = function (x, y) {
      var elements = document.elementsFromPoint(x, y);
      var layers = [];
      for (var i = 0; i < elements.length; i++) {
        var m = /rgba?\\(([^)]+)\\)/.exec(
          toRgb(getComputedStyle(elements[i]).backgroundColor),
        );
        if (!m) continue;
        var parts = m[1].split(',').map(parseFloat);
        var alpha = parts.length > 3 ? parts[3] : 1;
        if (!(alpha > 0)) continue;
        layers.push([parts[0], parts[1], parts[2], alpha]);
        if (alpha >= ${MIN_OPAQUE_ALPHA}) break;
      }
      var base = layers.pop();
      if (!base || base[3] < ${MIN_OPAQUE_ALPHA}) return '';
      for (var j = layers.length - 1; j >= 0; j--) {
        var layer = layers[j];
        for (var k = 0; k < 3; k++) {
          base[k] = layer[k] * layer[3] + base[k] * (1 - layer[3]);
        }
      }
      return (
        'rgb(' +
        Math.round(base[0]) +
        ', ' +
        Math.round(base[1]) +
        ', ' +
        Math.round(base[2]) +
        ')'
      );
    };
    var lastReport;
    var read = function () {
      // Walks up from <body> to <html>.
      var bodyColor = backgroundOf(document.body || document.documentElement);
      var color =
        backgroundOf(document.elementFromPoint(window.innerWidth / 2, 2)) ||
        bodyColor;
      var bottomColor =
        colorAt(window.innerWidth / 2, window.innerHeight - 2) || bodyColor;
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
      var report = color + '|' + bottomColor;
      if (report === lastReport) return;
      lastReport = report;
      window.ReactNativeWebView &&
        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: '${PAGE_THEME_MESSAGE_TYPE}',
            color: color,
            bottomColor: bottomColor,
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
    // What sits at the bottom of the viewport changes as the page scrolls:
    // read once the scroll settles, not during it (each read makes the page
    // compute styles and hit-test). Captured, because a scroll inside an
    // element does not bubble: dApp panels and lists scroll their own
    // containers, and the bottom of the viewport changes all the same.
    // The max wait keeps a scroller that never stops (a script-driven ticker)
    // from resetting the timer forever and starving every read, which would
    // leave the color stale even after the user scrolls the page itself. It
    // reads straight away rather than through a 0ms timer, which the next
    // frame's event would clear, and still schedules the trailing read: this
    // listener is a capture one on window, so it runs before the page's own
    // scroll handlers, and a read taken here could see an older layout.
    var SCROLL_SETTLE_MS = 150;
    var SCROLL_MAX_WAIT_MS = 1000;
    var scrollTimer;
    var scrollBurstStartedAt;
    var scheduleRead = function (delay) {
      scrollTimer = setTimeout(function () {
        scrollTimer = undefined;
        scrollBurstStartedAt = undefined;
        read();
      }, delay);
    };
    var onScroll = function () {
      var now = Date.now();
      if (scrollBurstStartedAt === undefined) {
        scrollBurstStartedAt = now;
      }
      clearTimeout(scrollTimer);
      if (now - scrollBurstStartedAt >= SCROLL_MAX_WAIT_MS) {
        scrollBurstStartedAt = now;
        read();
      }
      scheduleRead(SCROLL_SETTLE_MS);
    };
    window.addEventListener('scroll', onScroll, {
      passive: true,
      capture: true,
    });
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
