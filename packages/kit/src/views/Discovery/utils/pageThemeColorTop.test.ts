/** @jest-environment jsdom */
// The injected script is what decides the browser header color. These cases
// drive that script with a stubbed hit-test, because jsdom does not lay out.
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { PAGE_THEME_COLOR_SCRIPT } from './pageThemeColor';

const VIEW_W = 400;
const VIEW_H = 800;
const WIDE = VIEW_W;
const NARROW = 100;

type IHit = (x: number, y: number) => Element[];
type IReport = {
  type: string;
  color: string;
  bottomColor: string;
};

const postMessage = jest.fn();
let hit: IHit = () => [document.body];
// jsdom's CSS parser drops linear-gradient, so the inline style never sticks.
// The WebView's computed style keeps it. Remember the authored value and hand
// that string back from getComputedStyle.
const backgroundImages = new Map<Element, string>();
const realGetComputedStyle = globalThis.getComputedStyle.bind(globalThis);

function box(el: HTMLElement, width: number, top = 0, height = 3000, left = 0) {
  el.getBoundingClientRect = () =>
    ({
      x: left,
      y: top,
      width,
      height,
      top,
      left,
      right: left + width,
      bottom: top + height,
      toJSON() {
        return {};
      },
    }) as DOMRect;
}

function addLayer({
  backgroundColor,
  backgroundImage,
  width = WIDE,
  top = 0,
  height = 3000,
  style,
  tagName = 'div',
}: {
  backgroundColor?: string;
  backgroundImage?: string;
  width?: number;
  top?: number;
  height?: number;
  style?: Partial<CSSStyleDeclaration>;
  tagName?: keyof HTMLElementTagNameMap;
}) {
  const el = document.createElement(tagName);
  if (backgroundColor) {
    el.style.backgroundColor = backgroundColor;
  }
  if (backgroundImage) {
    backgroundImages.set(el, backgroundImage);
  }
  if (style) Object.assign(el.style, style);
  document.body.appendChild(el);
  box(el, width, top, height);
  return el;
}

function expectRgb(color: string, rgb: [number, number, number]) {
  const match = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/.exec(color);
  expect(match).not.toBeNull();
  expect(
    [match?.[1], match?.[2], match?.[3]].map((channel) =>
      Math.round(Number(channel)),
    ),
  ).toEqual(rgb);
}

function readNow() {
  const installed: unknown = Reflect.get(globalThis, '__onekeyReadPageTheme');
  if (typeof installed !== 'function') {
    throw new OneKeyLocalError('page theme script did not install');
  }
  const read = installed as () => void;
  read();
  jest.clearAllTimers();
  const calls = postMessage.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return JSON.parse(String(calls[calls.length - 1]?.[0])) as IReport;
}

let pageId = 0;

function resetPage() {
  pageId += 1;
  globalThis.history.replaceState(null, '', `/top-color-case-${pageId}`);
  backgroundImages.clear();
  document.body.replaceChildren();
  document.body.style.backgroundColor = 'rgb(255, 255, 255)';
  document.documentElement.style.backgroundColor = 'transparent';
  document.querySelectorAll('meta[name="theme-color"]').forEach((node) => {
    node.remove();
  });
  box(document.body, WIDE);
  box(document.documentElement, WIDE);
  hit = () => [document.body];
}

// y = 2 is the top edge. The bottom sample is near innerHeight, so the stub
// can hand it the document and keep the two paths apart.
function topStack(at: (x: number) => Element[]): IHit {
  return (x, y) => (y > 100 ? [document.body] : at(x));
}

beforeAll(() => {
  jest.useFakeTimers();
  Object.defineProperty(globalThis, 'innerWidth', {
    configurable: true,
    value: VIEW_W,
  });
  Object.defineProperty(globalThis, 'innerHeight', {
    configurable: true,
    value: VIEW_H,
  });
  Object.assign(document, {
    elementFromPoint: () => document.body,
    elementsFromPoint: (x: number, y: number) => hit(x, y),
  });
  globalThis.getComputedStyle = (el, pseudoElt) => {
    const style = realGetComputedStyle(el, pseudoElt);
    const image = backgroundImages.get(el);
    if (!image) {
      return style;
    }
    return new Proxy(style, {
      get(target, prop, receiver): unknown {
        if (prop === 'backgroundImage') {
          return image;
        }
        const value: unknown = Reflect.get(target, prop, receiver);
        if (typeof value !== 'function') {
          return value;
        }
        const call = value as (...args: unknown[]) => unknown;
        return (...args: unknown[]) => call.apply(target, args);
      },
    });
  };
  Object.assign(globalThis, {
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    ReactNativeWebView: { postMessage },
  });
  globalThis.addEventListener =
    EventTarget.prototype.addEventListener.bind(globalThis);
  resetPage();
  // The script is a string injected into WebViews; this is how it runs there.
  // eslint-disable-next-line no-new-func, @typescript-eslint/no-implied-eval
  const runScript = new Function(PAGE_THEME_COLOR_SCRIPT) as () => void;
  runScript();
  jest.clearAllTimers();
});

afterAll(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  postMessage.mockClear();
  resetPage();
});

describe('PAGE_THEME_COLOR_SCRIPT top color', () => {
  it('keeps a full-width opaque header and leaves the bottom sample alone', () => {
    const header = addLayer({ backgroundColor: 'rgb(10, 20, 30)' });
    document.body.style.backgroundColor = 'rgb(200, 200, 200)';
    hit = topStack(() => [header, document.body]);

    const report = readNow();

    expect(report.type).toBe('$onekeyPageThemeColor');
    expectRgb(report.color, [10, 20, 30]);
    expectRgb(report.bottomColor, [200, 200, 200]);
  });

  it('reads a full-width linear-gradient under a transparent layer', () => {
    const overlay = addLayer({ backgroundColor: 'transparent' });
    const gradient = addLayer({
      backgroundColor: 'transparent',
      backgroundImage:
        'linear-gradient(180deg, rgb(16, 205, 126), rgb(16, 205, 126) 19.45%, rgb(242, 254, 103) 54.1%, rgb(255, 255, 255) 69.15%)',
    });
    hit = topStack(() => [overlay, gradient, document.body]);

    expectRgb(readNow().color, [16, 205, 126]);
  });

  it('skips a narrow yellow button and uses the full-width bar under it', () => {
    const button = addLayer({
      backgroundColor: 'rgb(242, 254, 103)',
      width: NARROW,
    });
    const bar = addLayer({ backgroundColor: 'rgb(255, 255, 255)' });
    document.body.style.backgroundColor = 'rgb(30, 30, 30)';
    hit = topStack((x) =>
      x > 150 && x < 250 ? [button, bar, document.body] : [bar, document.body],
    );

    expectRgb(readNow().color, [255, 255, 255]);
  });

  it('rejects samples that only stay near the first one', () => {
    const left = addLayer({ backgroundColor: 'rgb(16, 0, 0)' });
    const center = addLayer({ backgroundColor: 'rgb(0, 0, 0)' });
    const right = addLayer({ backgroundColor: 'rgb(32, 0, 0)' });
    document.body.style.backgroundColor = 'rgb(9, 9, 9)';
    hit = topStack((x) => {
      if (x < 150) {
        return [left, document.body];
      }
      if (x > 250) {
        return [right, document.body];
      }
      return [center, document.body];
    });

    expectRgb(readNow().color, [9, 9, 9]);
  });

  it('drops disagreeing wide samples and uses the body color', () => {
    const green = addLayer({ backgroundColor: 'rgb(16, 205, 126)' });
    const blue = addLayer({ backgroundColor: 'rgb(0, 0, 255)' });
    document.body.style.backgroundColor = 'rgb(1, 2, 3)';
    hit = topStack((x) => {
      if (x < 150 || x > 250) {
        return [green, document.body];
      }
      return [blue, document.body];
    });

    expectRgb(readNow().color, [1, 2, 3]);
  });

  it('ignores a single non-empty sample', () => {
    const green = addLayer({ backgroundColor: 'rgb(16, 205, 126)' });
    document.body.style.backgroundColor = 'rgb(8, 8, 8)';
    hit = topStack((x) =>
      x > 150 && x < 250 ? [green, document.body] : [document.body],
    );

    expectRgb(readNow().color, [8, 8, 8]);
  });

  it('uses theme-color when samples and the document background are empty', () => {
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = 'rgb(9, 8, 7)';
    document.head.appendChild(meta);
    hit = () => [document.body];

    expectRgb(readNow().color, [9, 8, 7]);
  });

  it('skips a url background and falls through to the body', () => {
    const image = addLayer({
      backgroundColor: 'transparent',
      backgroundImage: 'url("https://example.com/hero.png")',
    });
    document.body.style.backgroundColor = 'rgb(4, 5, 6)';
    hit = topStack(() => [image, document.body]);

    expect(getComputedStyle(image).backgroundImage).toContain('url(');
    expectRgb(readNow().color, [4, 5, 6]);
  });

  it('samples the last stop of a to-top gradient at the top edge', () => {
    const gradient = addLayer({
      backgroundColor: 'transparent',
      backgroundImage:
        'linear-gradient(to top, rgb(1, 2, 3), rgb(16, 205, 126))',
      top: 2,
      height: 400,
    });
    hit = topStack(() => [gradient, document.body]);

    expectRgb(readNow().color, [16, 205, 126]);
  });

  it('reads a hex gradient stop without going through canvas', () => {
    const gradient = addLayer({
      backgroundColor: 'transparent',
      backgroundImage: 'linear-gradient(#10cd7e, #ffffff)',
    });
    hit = topStack(() => [gradient, document.body]);

    expectRgb(readNow().color, [16, 205, 126]);
  });

  it('does not replace a transparent first stop on an unknown angle', () => {
    const gradient = addLayer({
      backgroundColor: 'transparent',
      backgroundImage:
        'linear-gradient(45deg, rgba(0, 0, 0, 0), rgb(255, 0, 0))',
    });
    document.body.style.backgroundColor = 'rgb(3, 3, 3)';
    hit = topStack(() => [gradient, document.body]);

    expectRgb(readNow().color, [3, 3, 3]);
  });

  it('reads a hex theme-color without canvas', () => {
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#10cd7e';
    document.head.appendChild(meta);
    hit = () => [document.body];

    expectRgb(readNow().color, [16, 205, 126]);
  });

  it('falls back when the gradient angle is not axis-aligned', () => {
    const gradient = addLayer({
      backgroundColor: 'transparent',
      backgroundImage:
        'linear-gradient(45deg, rgb(16, 205, 126), rgb(255, 255, 255))',
    });
    document.body.style.backgroundColor = 'rgb(6, 6, 6)';
    hit = topStack(() => [gradient, document.body]);

    expectRgb(readNow().color, [6, 6, 6]);
  });

  it('does not adopt a horizontal gradient whose samples disagree', () => {
    const gradient = addLayer({
      backgroundColor: 'transparent',
      backgroundImage:
        'linear-gradient(to right, rgb(0, 0, 0), rgb(255, 0, 0))',
      height: 80,
    });
    document.body.style.backgroundColor = 'rgb(7, 7, 7)';
    hit = topStack(() => [gradient, document.body]);

    expectRgb(readNow().color, [7, 7, 7]);
  });

  it('reads a gradient above the same element opaque background color', () => {
    const gradient = addLayer({
      backgroundColor: 'rgb(255, 255, 255)',
      backgroundImage: 'linear-gradient(#10cd7e, #10cd7e, #ffffff)',
    });
    hit = topStack(() => [gradient, document.body]);

    expectRgb(readNow().color, [16, 205, 126]);
  });

  it('prefers a matching theme-color over the body fallback', () => {
    document.head.insertAdjacentHTML(
      'beforeend',
      '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000000">' +
        '<meta name="theme-color" content="#10cd7e">',
    );

    expectRgb(readNow().color, [16, 205, 126]);
  });

  it('keeps a trusted top surface ahead of theme-color', () => {
    const header = addLayer({ backgroundColor: 'rgb(10, 20, 30)' });
    document.head.insertAdjacentHTML(
      'beforeend',
      '<meta name="theme-color" content="#10cd7e">',
    );
    hit = topStack(() => [header, document.body]);

    expectRgb(readNow().color, [10, 20, 30]);
  });

  it('continues past a transparent theme-color', () => {
    document.head.insertAdjacentHTML(
      'beforeend',
      '<meta name="theme-color" content="rgba(1, 2, 3, 0)">' +
        '<meta name="theme-color" content="#10cd7e">',
    );

    expectRgb(readNow().color, [16, 205, 126]);
  });

  it('does not see through an image to a solid wide layer', () => {
    const image = addLayer({
      backgroundColor: 'rgb(255, 0, 0)',
      backgroundImage: 'url("https://example.com/hero.png")',
    });
    const underneath = addLayer({ backgroundColor: 'rgb(16, 205, 126)' });
    document.body.style.backgroundColor = 'rgb(4, 5, 6)';
    hit = topStack(() => [image, underneath, document.body]);

    expectRgb(readNow().color, [4, 5, 6]);
  });

  it('rejects the group if one point has an unreadable wide surface', () => {
    const image = addLayer({
      backgroundImage: 'url("https://example.com/hero.png")',
    });
    const underneath = addLayer({ backgroundColor: 'rgb(16, 205, 126)' });
    document.body.style.backgroundColor = 'rgb(4, 5, 6)';
    hit = topStack((x) =>
      x === VIEW_W / 2
        ? [image, underneath, document.body]
        : [underneath, document.body],
    );

    expectRgb(readNow().color, [4, 5, 6]);
  });

  it.each([
    'repeating-linear-gradient(#10cd7e 0px, #ffffff 10px)',
    'linear-gradient(#10cd7e, #ffffff), linear-gradient(#000000, #000000)',
    'linear-gradient(rgba(16, 205, 126, 0.5), #ffffff)',
    'radial-gradient(#10cd7e, #ffffff)',
    'linear-gradient(to bottom right, #10cd7e, #ffffff)',
  ])('falls back for an unsupported background: %s', (backgroundImage) => {
    const surface = addLayer({ backgroundImage });
    const underneath = addLayer({ backgroundColor: 'rgb(16, 205, 126)' });
    document.body.style.backgroundColor = 'rgb(4, 5, 6)';
    hit = topStack(() => [surface, underneath, document.body]);

    expectRgb(readNow().color, [4, 5, 6]);
  });

  it.each([
    { backgroundSize: '50% 50%' },
    { backgroundPosition: 'center' },
    { transform: 'scale(2)' },
    { backgroundAttachment: 'fixed' },
  ])('rejects gradient geometry it cannot reproduce: %j', (style) => {
    const surface = addLayer({
      backgroundImage: 'linear-gradient(#10cd7e, #10cd7e)',
      style,
    });
    document.body.style.backgroundColor = 'rgb(4, 5, 6)';
    hit = topStack(() => [surface, document.body]);

    expectRgb(readNow().color, [4, 5, 6]);
  });

  it.each([{ filter: 'blur(2px)' }, { opacity: '0.5' }])(
    'does not treat an effect layer as its opaque background: %j',
    (style) => {
      const surface = addLayer({ backgroundColor: 'rgb(16, 205, 126)', style });
      document.body.style.backgroundColor = 'rgb(4, 5, 6)';
      hit = topStack(() => [surface, document.body]);

      expectRgb(readNow().color, [4, 5, 6]);
    },
  );

  it('accepts two matching samples when the remaining point is empty', () => {
    const surface = addLayer({ backgroundColor: 'rgb(16, 205, 126)' });
    hit = topStack((x) =>
      x === VIEW_W / 2 ? [document.body] : [surface, document.body],
    );

    expectRgb(readNow().color, [16, 205, 126]);
  });

  it('does not bypass agreement by sampling a body gradient at one point', () => {
    backgroundImages.set(
      document.body,
      'linear-gradient(to right, #000000, #ff0000)',
    );

    expect(readNow().color).toBe('');
  });

  it('rejects an opaque child painted inside a translucent ancestor', () => {
    const parent = addLayer({ style: { opacity: '0.5' } });
    const child = addLayer({ backgroundColor: 'rgb(16, 205, 126)' });
    parent.appendChild(child);
    document.body.style.backgroundColor = 'rgb(4, 5, 6)';
    hit = topStack(() => [child, parent, document.body]);

    expectRgb(readNow().color, [4, 5, 6]);
  });

  it('samples a vertical body gradient through the three top points', () => {
    backgroundImages.set(
      document.body,
      'linear-gradient(#10cd7e, #10cd7e, #ffffff)',
    );

    expectRgb(readNow().color, [16, 205, 126]);
  });

  it('keeps document base colors from hiding a negative-z background sample', () => {
    const overlay = addLayer({ backgroundColor: 'transparent' });
    const gradient = addLayer({
      backgroundImage: 'linear-gradient(#10cd7e, #10cd7e, #ffffff)',
    });
    hit = topStack(() => [
      overlay,
      document.body,
      gradient,
      document.documentElement,
    ]);

    expectRgb(readNow().color, [16, 205, 126]);
  });

  it.each(['a', 'button', 'input', 'select', 'textarea', 'summary'] as const)(
    'skips a wide %s control covering all three samples',
    (tagName) => {
      const control = addLayer({
        tagName,
        backgroundColor: 'rgb(242, 254, 103)',
        width: VIEW_W * 0.85,
      });
      if (tagName === 'a')
        control.setAttribute('href', 'https://app.tinyman.org/');
      const gradient = addLayer({
        backgroundImage: 'linear-gradient(#10cd7e, #10cd7e, #ffffff)',
      });
      hit = topStack(() => [control, gradient, document.body]);

      expectRgb(readNow().color, [16, 205, 126]);
    },
  );

  it.each(['button', 'link'])(
    'skips the painted descendant of a wide role=%s control',
    (role) => {
      const control = addLayer({ width: VIEW_W * 0.85 });
      control.setAttribute('role', role);
      const label = addLayer({
        backgroundColor: 'rgb(242, 254, 103)',
        width: VIEW_W * 0.85,
      });
      control.appendChild(label);
      const gradient = addLayer({
        backgroundImage: 'linear-gradient(#10cd7e, #10cd7e, #ffffff)',
      });
      hit = topStack(() => [label, control, gradient, document.body]);

      expectRgb(readNow().color, [16, 205, 126]);
    },
  );

  it('keeps a navigation bar background underneath its wide action link', () => {
    const bar = addLayer({
      tagName: 'nav',
      backgroundColor: 'rgb(250, 250, 250)',
    });
    const action = addLayer({
      tagName: 'a',
      backgroundColor: 'rgb(242, 254, 103)',
      width: VIEW_W * 0.85,
    });
    action.setAttribute('href', 'https://app.tinyman.org/');
    bar.appendChild(action);
    document.body.style.backgroundColor = 'rgb(16, 205, 126)';
    hit = topStack(() => [action, bar, document.body]);

    expectRgb(readNow().color, [250, 250, 250]);
  });

  it('skips a native button descendant when the button is absent from the hit stack', () => {
    const button = addLayer({ tagName: 'button', width: VIEW_W * 0.85 });
    const label = addLayer({
      backgroundColor: 'rgb(242, 254, 103)',
      width: VIEW_W * 0.85,
    });
    button.appendChild(label);
    const surface = addLayer({ backgroundColor: 'rgb(16, 205, 126)' });
    hit = topStack(() => [label, surface, document.body]);

    expectRgb(readNow().color, [16, 205, 126]);
  });
});
