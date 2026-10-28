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
}: {
  backgroundColor?: string;
  backgroundImage?: string;
  width?: number;
  top?: number;
  height?: number;
}) {
  const el = document.createElement('div');
  if (backgroundColor) {
    el.style.backgroundColor = backgroundColor;
  }
  if (backgroundImage) {
    backgroundImages.set(el, backgroundImage);
  }
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

function resetPage() {
  backgroundImages.clear();
  document.body.replaceChildren();
  document.body.style.backgroundColor = 'rgb(255, 255, 255)';
  document.documentElement.style.backgroundColor = 'transparent';
  document.querySelectorAll('meta[name="theme-color"]').forEach((node) => {
    node.remove();
  });
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

  it('uses the first stop when the gradient angle is not axis-aligned', () => {
    const gradient = addLayer({
      backgroundColor: 'transparent',
      backgroundImage:
        'linear-gradient(45deg, rgb(16, 205, 126), rgb(255, 255, 255))',
    });
    hit = topStack(() => [gradient, document.body]);

    expectRgb(readNow().color, [16, 205, 126]);
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
});
