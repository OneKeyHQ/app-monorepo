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

// A top-edge layer narrower than this is a button or banner, not the page
// surface behind the browser header.
const MIN_BAR_WIDTH_RATIO = 0.8;
// Just inside the top of the WebView, the same y as the previous single sample.
const TOP_SAMPLE_Y = 2;
// Inset from the edges so a side rail is not the only thing measured.
const TOP_SAMPLE_X_RATIOS = [0.25, 0.5, 0.75];
// Anti-aliasing can disagree by a few levels. A button and the page cannot.
const COLOR_CHANNEL_DELTA = 16;

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

// Reports the page color the way Safari 26 tints its chrome. The top color is
// the background behind the top edge: three samples, and only a layer about as
// wide as the viewport can win, so a button or small banner cannot. A wide
// linear-gradient counts; its color is the stop at that point, which a
// transparent background-color would miss. Matching <meta name="theme-color">,
// then body/html, are fallbacks. The bottom color is separate: it can differ
// from the top (a colored banner over a gray page, or a dark container over
// a white body) and follows scrolling, so a bottom sheet brings its own color.
// The top color is stable while scrolling. Each page gets an initial read and
// at most one late-paint correction, canceled once scrolling starts. A route
// or theme change starts a new top-color read; the bottom keeps following the
// viewport independently.
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
      // Hex is resolved here so a gradient stop and a theme-color meta share
      // one path, including when the 1px canvas cannot read the color.
      var hex = hexToRgb(value);
      rgbCache[value] = hex || canvasRgb(value);
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
    // Top-edge samples. Narrow layers are buttons and banners. body/html are
    // not samples: they are the fallback below, and counting them here would
    // make every point agree on the document color.
    var SAMPLE_X = [${TOP_SAMPLE_X_RATIOS.join(', ')}];
    var SAMPLE_Y = ${TOP_SAMPLE_Y};
    var MIN_WIDTH_RATIO = ${MIN_BAR_WIDTH_RATIO};
    var CHANNEL_DELTA = ${COLOR_CHANNEL_DELTA};
    var splitTop = function (value) {
      var parts = [];
      var depth = 0;
      var start = 0;
      for (var i = 0; i < value.length; i++) {
        var ch = value.charAt(i);
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        else if (ch === ',' && depth === 0) {
          parts.push(value.slice(start, i));
          start = i + 1;
        }
      }
      parts.push(value.slice(start));
      return parts;
    };
    var channelsOf = function (color) {
      var match = /rgba?\\(\\s*([\\d.]+)\\s*,\\s*([\\d.]+)\\s*,\\s*([\\d.]+)/.exec(
        color,
      );
      if (!match) return null;
      return [
        Math.round(parseFloat(match[1])),
        Math.round(parseFloat(match[2])),
        Math.round(parseFloat(match[3])),
      ];
    };
    var rgbString = function (channels) {
      return (
        'rgb(' + channels[0] + ', ' + channels[1] + ', ' + channels[2] + ')'
      );
    };
    var isWideEnough = function (el) {
      var rect = el.getBoundingClientRect();
      return rect.width >= window.innerWidth * MIN_WIDTH_RATIO;
    };
    var opaqueColor = function (bg) {
      var color = toRgb(bg);
      if (!isOpaque(color)) return '';
      var channels = channelsOf(color);
      return channels ? rgbString(channels) : '';
    };
    var hexToRgb = function (value) {
      var match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
      if (!match) return '';
      var hex = match[1];
      if (hex.length === 3) {
        hex =
          hex.charAt(0) +
          hex.charAt(0) +
          hex.charAt(1) +
          hex.charAt(1) +
          hex.charAt(2) +
          hex.charAt(2);
      }
      var n = parseInt(hex, 16);
      return rgbString([(n >> 16) & 255, (n >> 8) & 255, n & 255]);
    };
    var gradientAxis = function (token) {
      var text = token.trim().toLowerCase();
      if (text === 'to bottom') return 'y';
      if (text === 'to top') return 'y-reverse';
      if (text === 'to right') return 'x';
      if (text === 'to left') return 'x-reverse';
      var match = /^(-?[\\d.]+)deg$/.exec(text);
      if (!match) return '';
      var deg = parseFloat(match[1]) % 360;
      if (deg < 0) deg += 360;
      if (deg === 180) return 'y';
      if (deg === 0) return 'y-reverse';
      if (deg === 90) return 'x';
      if (deg === 270) return 'x-reverse';
      return '';
    };
    var isGradientDirection = function (token) {
      var text = token.trim().toLowerCase();
      return (
        text.indexOf('to ') === 0 || /^(-?[\\d.]+)(deg|turn|rad)$/.test(text)
      );
    };
    var parseStop = function (token) {
      var text = token.trim();
      var pos = null;
      var posMatch = /(-?[\\d.]+)(%|px)\\s*$/.exec(text);
      if (posMatch) {
        pos = { value: parseFloat(posMatch[1]), unit: posMatch[2] };
        text = text.slice(0, posMatch.index).trim();
      }
      var color = toRgb(text);
      var channels = color ? channelsOf(color) : null;
      if (!channels) return null;
      var alpha = 1;
      var alphaMatch = /rgba\\([^,]+,[^,]+,[^,]+,\\s*([\\d.]+)\\s*\\)/.exec(
        color,
      );
      if (alphaMatch) alpha = parseFloat(alphaMatch[1]);
      return { channels: channels, alpha: alpha, pos: pos };
    };
    var stopPositions = function (stops, axisLength) {
      var positions = [];
      for (var i = 0; i < stops.length; i++) {
        var pos = stops[i].pos;
        if (!pos) positions.push(null);
        else if (pos.unit === '%') positions.push(pos.value / 100);
        else if (pos.unit === 'px' && axisLength > 0)
          positions.push(pos.value / axisLength);
        else positions.push(null);
      }
      if (!positions.length) return positions;
      if (positions[0] === null) positions[0] = 0;
      var last = positions.length - 1;
      if (positions[last] === null) positions[last] = 1;
      var index = 0;
      while (index < positions.length) {
        if (positions[index] !== null) {
          index++;
          continue;
        }
        var start = index - 1;
        var end = index + 1;
        while (end < positions.length && positions[end] === null) end++;
        if (start < 0 || end >= positions.length || positions[start] === null || positions[end] === null) {
          index++;
          continue;
        }
        var span = end - start;
        for (var k = 1; k < span; k++) {
          positions[start + k] =
            positions[start] + ((positions[end] - positions[start]) * k) / span;
        }
        index = end;
      }
      return positions;
    };
    var colorAtStop = function (stops, positions, t) {
      if (t <= positions[0]) return stops[0];
      var last = positions.length - 1;
      if (t >= positions[last]) return stops[last];
      var i = 1;
      while (i < positions.length && positions[i] < t) i++;
      var from = stops[i - 1];
      var to = stops[i];
      var span = positions[i] - positions[i - 1];
      var u = span === 0 ? 0 : (t - positions[i - 1]) / span;
      var channels = [
        from.channels[0] + (to.channels[0] - from.channels[0]) * u,
        from.channels[1] + (to.channels[1] - from.channels[1]) * u,
        from.channels[2] + (to.channels[2] - from.channels[2]) * u,
      ];
      for (var k = 0; k < 3; k++) {
        channels[k] = Math.round(channels[k]);
        if (channels[k] < 0) channels[k] = 0;
        if (channels[k] > 255) channels[k] = 255;
      }
      return {
        channels: channels,
        alpha: from.alpha + (to.alpha - from.alpha) * u,
      };
    };
    var opaqueStopColor = function (stop) {
      if (!stop || !(stop.alpha >= ${MIN_OPAQUE_ALPHA})) return '';
      for (var i = 0; i < 3; i++) {
        if (!isFinite(stop.channels[i])) return '';
      }
      return rgbString(stop.channels);
    };
    var clamp01 = function (n) {
      if (n < 0) return 0;
      if (n > 1) return 1;
      return n;
    };
    // Only axis-aligned, opaque gradients with unambiguous stops are sampled.
    // Unsupported syntax must not turn into an unrelated first-stop color.
    var sampleLinearGradient = function (body, el, x, y) {
      var args = splitTop(body);
      if (!args.length) return '';
      var axis = 'y';
      var start = 0;
      if (isGradientDirection(args[0])) {
        axis = gradientAxis(args[0]);
        if (!axis) return '';
        start = 1;
      }
      var stops = [];
      for (var i = start; i < args.length; i++) {
        var stop = parseStop(args[i]);
        if (!stop || !isFinite(stop.alpha) || stop.alpha < 1) return '';
        if (stop.pos && !isFinite(stop.pos.value)) return '';
        stops.push(stop);
      }
      if (stops.length < 2) return '';
      var rect = el.getBoundingClientRect();
      if (!(rect.width > 0 && rect.height > 0)) return '';
      var horizontal = axis === 'x' || axis === 'x-reverse';
      var positions = stopPositions(
        stops,
        horizontal ? rect.width : rect.height,
      );
      for (var j = 1; j < positions.length; j++) {
        if (positions[j] < positions[j - 1]) return '';
      }
      var yRatio = rect.height > 0 ? clamp01((y - rect.top) / rect.height) : 0;
      var xRatio = rect.width > 0 ? clamp01((x - rect.left) / rect.width) : 0;
      var t =
        axis === 'y'
          ? yRatio
          : axis === 'y-reverse'
            ? 1 - yRatio
            : axis === 'x'
              ? xRatio
              : 1 - xRatio;
      return opaqueStopColor(colorAtStop(stops, positions, t));
    };
    var gradientAt = function (image, el, style, x, y) {
      var layers = splitTop(image);
      if (layers.length !== 1) return '';
      var layer = layers[0].trim();
      var prefix = 'linear-gradient(';
      if (layer.toLowerCase().indexOf(prefix) !== 0 || layer.slice(-1) !== ')') {
        return '';
      }
      // The interpolation uses the element box. A positioned, resized or
      // transformed background needs geometry this sampler cannot reproduce.
      var size = style.backgroundSize;
      var position = style.backgroundPosition;
      if (size && size !== 'auto' && size !== 'auto auto' && size !== '100% 100%') {
        return '';
      }
      if (position && position !== '0% 0%' && position !== '0px 0px') return '';
      if (style.backgroundOrigin &&
          style.backgroundOrigin !== 'padding-box' &&
          style.backgroundOrigin !== 'border-box') return '';
      if (style.backgroundClip &&
          style.backgroundClip !== 'border-box' &&
          style.backgroundClip !== 'padding-box') return '';
      if (style.transform && style.transform !== 'none') return '';
      if (style.backgroundAttachment && style.backgroundAttachment !== 'scroll') return '';
      if (parseFloat(style.borderTopWidth) > 0 ||
          parseFloat(style.borderRightWidth) > 0 ||
          parseFloat(style.borderBottomWidth) > 0 ||
          parseFloat(style.borderLeftWidth) > 0) return '';
      return sampleLinearGradient(layer.slice(prefix.length, -1), el, x, y);
    };
    // Empty means transparent; null means painted content we cannot infer.
    // Never look through an unknown wide surface to a convenient solid below.
    var topLayerColor = function (el, x, y) {
      var style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' ||
          (style.opacity !== '' && Number(style.opacity) === 0)) return '';
      if (style.opacity && Number(style.opacity) < 1) return null;
      if (style.filter && style.filter !== 'none') return null;
      if (style.backdropFilter && style.backdropFilter !== 'none') return null;
      if (style.maskImage && style.maskImage !== 'none') return null;
      var ancestor = el.parentElement;
      while (ancestor) {
        var parentStyle = getComputedStyle(ancestor);
        if (parentStyle.opacity && Number(parentStyle.opacity) === 0) return '';
        if ((parentStyle.opacity && Number(parentStyle.opacity) < 1) ||
            (parentStyle.filter && parentStyle.filter !== 'none') ||
            (parentStyle.backdropFilter && parentStyle.backdropFilter !== 'none') ||
            (parentStyle.maskImage && parentStyle.maskImage !== 'none')) return null;
        ancestor = ancestor.parentElement;
      }
      if (/^(IMG|VIDEO|CANVAS|IFRAME|SVG|OBJECT|EMBED)$/.test(el.tagName.toUpperCase())) return null;
      var image = style.backgroundImage;
      if (image && image !== 'none') {
        return gradientAt(image, el, style, x, y) || null;
      }
      var solid = opaqueColor(style.backgroundColor);
      if (solid) return solid;
      var color = toRgb(style.backgroundColor);
      var alpha = /rgba\\([^,]+,[^,]+,[^,]+,\\s*([\\d.]+)\\s*\\)/.exec(color);
      return !color || (alpha && Number(alpha[1]) === 0) ? '' : null;
    };
    var colorAtTopPoint = function (x, y) {
      var elements = document.elementsFromPoint(x, y) || [];
      for (var i = 0; i < elements.length; i++) {
        var el = elements[i];
        if (!el) return '';
        if (el === document.body || el === document.documentElement) {
          // A document gradient must pass the same three-point agreement.
          // Plain document colors remain the fallback after theme-color.
          var image = getComputedStyle(el).backgroundImage;
          if (image && image !== 'none') return topLayerColor(el, x, y);
          continue;
        }
        // Mobile action buttons can span the viewport and cover all samples.
        // Exclude their painted descendants too, but keep the surrounding bar.
        if (el.closest('a[href], button, input, select, textarea, summary, [role~="button"], [role~="link"]')) continue;
        if (!isWideEnough(el)) continue;
        var color = topLayerColor(el, x, y);
        if (color !== '') return color;
      }
      return '';
    };
    var documentTopColor = function () {
      var el = document.body || document.documentElement;
      while (el && el.nodeType === 1) {
        // Document fallbacks are solid base colors, not a fourth, single-point
        // gradient sample that could bypass the three-point agreement rule.
        var image = getComputedStyle(el).backgroundImage;
        if (image && image !== 'none') return '';
        var color = topLayerColor(el, window.innerWidth / 2, SAMPLE_Y);
        if (color === null) return '';
        if (color) return color;
        el = el.parentElement;
      }
      return '';
    };
    // Empty samples are ignored. One lone sample is not enough: it is the
    // case the width check could not reject. The center sample wins when the
    // others agree with it.
    var agreedTopColor = function () {
      var samples = [];
      for (var i = 0; i < SAMPLE_X.length; i++) {
        samples.push(
          colorAtTopPoint(window.innerWidth * SAMPLE_X[i], SAMPLE_Y),
        );
      }
      // An unreadable image/filter is not an empty vote. Reject the group
      // rather than allowing two other points to hide that uncertainty.
      if (samples.indexOf(null) !== -1) return '';
      var present = [];
      for (var j = 0; j < samples.length; j++) {
        if (samples[j]) present.push({ index: j, color: samples[j] });
      }
      if (present.length < 2) return '';
      // The whole set has to sit within the delta, not each sample against
      // the first one (that would allow the ends to drift twice as far).
      var min = null;
      var max = null;
      for (var k = 0; k < present.length; k++) {
        var channels = channelsOf(present[k].color);
        if (!channels) return '';
        if (!min) {
          min = [channels[0], channels[1], channels[2]];
          max = [channels[0], channels[1], channels[2]];
          continue;
        }
        for (var c = 0; c < 3; c++) {
          if (channels[c] < min[c]) min[c] = channels[c];
          if (channels[c] > max[c]) max[c] = channels[c];
        }
      }
      for (var d = 0; d < 3; d++) {
        if (max[d] - min[d] > CHANNEL_DELTA) return '';
      }
      for (var n = 0; n < present.length; n++) {
        if (SAMPLE_X[present[n].index] === 0.5) return present[n].color;
      }
      return present[0].color;
    };
    var readTop = function () {
      var color = agreedTopColor();
      if (!color) {
        var metas = document.querySelectorAll('meta[name="theme-color"]');
        for (var i = 0; i < metas.length; i++) {
          var media = metas[i].getAttribute('media');
          if (!media || window.matchMedia(media).matches) {
            color = opaqueColor(metas[i].getAttribute('content'));
            if (color) break;
          }
        }
      }
      return color || documentTopColor();
    };
    var lastReport;
    var topColor = '';
    var read = function (updateTop) {
      if (updateTop) topColor = readTop();
      var bodyColor = backgroundOf(document.body || document.documentElement);
      var bottomColor =
        colorAt(window.innerWidth / 2, window.innerHeight - 2) || bodyColor;
      var report = topColor + '|' + bottomColor;
      if (report === lastReport) return;
      lastReport = report;
      window.ReactNativeWebView &&
        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: '${PAGE_THEME_MESSAGE_TYPE}',
            color: topColor,
            bottomColor: bottomColor,
          }),
        );
    };
    var topCorrectionTimer;
    var pending;
    var cancelTopCorrection = function () {
      clearTimeout(topCorrectionTimer);
      topCorrectionTimer = undefined;
    };
    var startTopRead = function () {
      cancelTopCorrection();
      read(true);
      topCorrectionTimer = setTimeout(function () {
        topCorrectionTimer = undefined;
        read(true);
      }, 800);
    };
    var scheme = window.matchMedia('(prefers-color-scheme: dark)');
    // Layout classes such as "scrolled" must not unlock the top color. Watch
    // explicit theme markers and color-scheme instead of arbitrary DOM changes.
    var themeKey = function () {
      var parts = [scheme.matches];
      var roots = [document.documentElement, document.body];
      for (var i = 0; i < roots.length; i++) {
        var el = roots[i];
        if (!el) continue;
        var classes = (el.getAttribute('class') || '').split(/\\s+/).filter(function (name) {
          return /(^|[-_])(dark|light)([-_]|$)/i.test(name);
        }).sort();
        parts.push(classes.join(' '), el.getAttribute('data-theme'),
          el.getAttribute('data-color-mode'), el.getAttribute('data-mode'),
          getComputedStyle(el).colorScheme);
      }
      var metas = document.querySelectorAll('meta[name="theme-color"]');
      for (var j = 0; j < metas.length; j++) {
        var media = metas[j].getAttribute('media');
        if (!media || window.matchMedia(media).matches) {
          parts.push(metas[j].getAttribute('content'));
        }
      }
      return JSON.stringify(parts);
    };
    var lastThemeKey;
    var pageKey = function () {
      var hash = window.location.hash;
      var routeHash = hash.indexOf('#/') === 0 || hash.indexOf('#!/') === 0;
      return window.location.href.split('#')[0] + (routeHash ? hash : '');
    };
    var lastPageKey;
    // Re-injection re-reports even unchanged colors. Only a different route
    // unlocks the top; anchors and back-forward cache restores keep its tint.
    var refresh = function () {
      lastReport = undefined;
      var nextPageKey = pageKey();
      if (nextPageKey !== lastPageKey) {
        clearTimeout(pending);
        pending = null;
        lastPageKey = nextPageKey;
        lastThemeKey = themeKey();
        startTopRead();
      } else {
        read(false);
      }
    };
    window.__onekeyReadPageTheme = refresh;
    window.addEventListener('pageshow', function (event) {
      if (event.persisted) refresh();
    });
    refresh();
    scheme.addEventListener && scheme.addEventListener('change', function () {
      lastThemeKey = themeKey();
      startTopRead();
    });
    var schedule = function () {
      if (pending) return;
      pending = setTimeout(function () {
        pending = null;
        var nextThemeKey = themeKey();
        if (nextThemeKey !== lastThemeKey) {
          lastThemeKey = nextThemeKey;
          startTopRead();
        } else {
          read(false);
        }
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
        read(false);
      }, delay);
    };
    var onScroll = function (event) {
      var target = event && event.target;
      // Only the page itself moving means the top edge may now be a lower
      // section. A panel, ticker, or list scrolling inside the page must not
      // drop the one late first-screen read. The listener stays on window
      // capture so those inner scrolls still update the bottom color.
      if (
        target === document ||
        target === document.documentElement ||
        target === document.body ||
        target === window
      ) {
        cancelTopCorrection();
      }
      var now = Date.now();
      if (scrollBurstStartedAt === undefined) {
        scrollBurstStartedAt = now;
      }
      clearTimeout(scrollTimer);
      if (now - scrollBurstStartedAt >= SCROLL_MAX_WAIT_MS) {
        scrollBurstStartedAt = now;
        read(false);
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
            if (isThemeMeta(m.target) || m.attributeName === 'name') return schedule();
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
          attributeFilter: ['content', 'media', 'name'],
        });
    }
  } catch (e) {}
})();
true;`;
