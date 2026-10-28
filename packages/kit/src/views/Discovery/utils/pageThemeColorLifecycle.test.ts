/** @jest-environment jsdom */
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { PAGE_THEME_COLOR_SCRIPT } from './pageThemeColor';

type IReport = { color: string; bottomColor: string };
const postMessage = jest.fn<void, [string]>();
let header: HTMLDivElement;
let pageId = 0;
let systemDark = false;
let onSchemeChange: (() => void) | undefined;

function refresh() {
  const read: unknown = Reflect.get(globalThis, '__onekeyReadPageTheme');
  if (typeof read !== 'function') {
    throw new OneKeyLocalError('page theme script did not install');
  }
  const refreshPage = read as () => void;
  refreshPage();
}

function latest(): IReport {
  const message = postMessage.mock.calls.at(-1)?.[0];
  if (!message) throw new OneKeyLocalError('missing page theme report');
  return JSON.parse(message) as IReport;
}

function scroll() {
  globalThis.dispatchEvent(new Event('scroll'));
}

function resetPage() {
  jest.clearAllTimers();
  pageId += 1;
  globalThis.history.replaceState(null, '', `/theme-lifecycle-${pageId}`);
  for (const root of [document.documentElement, document.body]) {
    for (const attr of [
      'class',
      'style',
      'data-theme',
      'data-color-mode',
      'data-mode',
    ]) {
      root.removeAttribute(attr);
    }
  }
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => meta.remove());
  document.body.replaceChildren();
  document.body.style.backgroundColor = 'rgb(255, 255, 255)';
  header = document.createElement('div');
  header.style.backgroundColor = 'rgb(16, 205, 126)';
  header.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 400,
    bottom: 60,
    width: 400,
    height: 60,
    toJSON() {
      return {};
    },
  });
  document.body.appendChild(header);
  systemDark = false;
  postMessage.mockClear();
}

beforeAll(() => {
  jest.useFakeTimers();
  Object.defineProperties(globalThis, {
    innerWidth: { configurable: true, value: 400 },
    innerHeight: { configurable: true, value: 800 },
  });
  Object.assign(document, {
    elementsFromPoint: (_x: number, y: number) =>
      y === 2
        ? [header, document.body, document.documentElement]
        : [document.body, document.documentElement],
  });
  Object.assign(globalThis, {
    matchMedia: () => ({
      get matches() {
        return systemDark;
      },
      addEventListener: (_event: string, listener: () => void) => {
        onSchemeChange = listener;
      },
    }),
    ReactNativeWebView: { postMessage },
  });
  globalThis.addEventListener =
    EventTarget.prototype.addEventListener.bind(globalThis);
  resetPage();
  // Execute the actual injected script rather than a copy of its state machine.
  // eslint-disable-next-line no-new-func, @typescript-eslint/no-implied-eval
  const run = new Function(PAGE_THEME_COLOR_SCRIPT) as () => void;
  run();
});

beforeEach(() => {
  resetPage();
  refresh();
});

afterAll(() => {
  jest.useRealTimers();
});

describe('PAGE_THEME_COLOR_SCRIPT top color lifetime', () => {
  it('keeps the top tint while scrolling and continues updating the bottom', () => {
    jest.advanceTimersByTime(800);
    header.style.backgroundColor = 'rgb(255, 255, 255)';
    document.body.style.backgroundColor = 'rgb(10, 20, 30)';
    scroll();
    jest.advanceTimersByTime(160);

    expect(latest()).toMatchObject({
      color: 'rgb(16, 205, 126)',
      bottomColor: 'rgb(10, 20, 30)',
    });
  });

  it('allows one late-paint correction and then keeps the result', () => {
    header.style.backgroundColor = 'rgb(10, 20, 30)';
    jest.advanceTimersByTime(800);
    expect(latest().color).toBe('rgb(10, 20, 30)');
    header.style.backgroundColor = 'rgb(255, 255, 255)';
    jest.advanceTimersByTime(5000);
    refresh();
    expect(latest().color).toBe('rgb(10, 20, 30)');
  });

  it('cancels the late correction if the user scrolls before it runs', () => {
    header.style.backgroundColor = 'rgb(242, 254, 103)';
    scroll();
    jest.advanceTimersByTime(1000);
    refresh();

    expect(latest().color).toBe('rgb(16, 205, 126)');
  });

  it('does not unlock the top for an ordinary anchor jump', () => {
    jest.advanceTimersByTime(800);
    header.style.backgroundColor = 'rgb(242, 254, 103)';
    globalThis.history.replaceState(null, '', '#features');
    refresh();
    jest.advanceTimersByTime(1000);

    expect(latest().color).toBe('rgb(16, 205, 126)');
  });

  it('starts a fresh top-color cycle on an SPA pathname change', () => {
    header.style.backgroundColor = 'rgb(10, 20, 30)';
    globalThis.history.pushState(null, '', '/another-route');
    refresh();

    expect(latest().color).toBe('rgb(10, 20, 30)');
  });

  it('recognizes hash-router navigation separately from anchors', () => {
    header.style.backgroundColor = 'rgb(10, 20, 30)';
    globalThis.history.replaceState(null, '', '#/swap');
    refresh();
    expect(latest().color).toBe('rgb(10, 20, 30)');
    header.style.backgroundColor = 'rgb(30, 40, 50)';
    globalThis.history.replaceState(null, '', '#/earn');
    refresh();
    expect(latest().color).toBe('rgb(30, 40, 50)');
  });

  it('retains its original tint when restored at a different scroll position', () => {
    jest.advanceTimersByTime(800);
    header.style.backgroundColor = 'rgb(242, 254, 103)';
    globalThis.dispatchEvent(
      new PageTransitionEvent('pageshow', { persisted: true }),
    );

    expect(latest().color).toBe('rgb(16, 205, 126)');
  });

  it('ignores layout-only class and inline-style mutations', async () => {
    jest.advanceTimersByTime(800);
    header.style.backgroundColor = 'rgb(242, 254, 103)';
    document.body.classList.add('scrolled');
    document.documentElement.style.setProperty('--scroll-progress', '0.5');
    await Promise.resolve();
    jest.advanceTimersByTime(1200);
    refresh();

    expect(latest().color).toBe('rgb(16, 205, 126)');
  });

  it.each(['class', 'data-theme', 'data-color-mode', 'data-mode'])(
    'unlocks the top for a website theme change through %s',
    async (attr) => {
      jest.advanceTimersByTime(800);
      header.style.backgroundColor = 'rgb(0, 0, 0)';
      document.documentElement.setAttribute(
        attr,
        attr === 'class' ? 'layout dark' : 'dark',
      );
      await Promise.resolve();
      jest.advanceTimersByTime(300);

      expect(latest().color).toBe('rgb(0, 0, 0)');
    },
  );

  it('updates when the system color scheme changes', () => {
    jest.advanceTimersByTime(800);
    header.style.backgroundColor = 'rgb(0, 0, 0)';
    systemDark = true;
    if (!onSchemeChange)
      throw new OneKeyLocalError('missing color scheme listener');
    onSchemeChange();

    expect(latest().color).toBe('rgb(0, 0, 0)');
  });

  it('updates when theme-color is added or changed', async () => {
    jest.advanceTimersByTime(800);
    header.style.backgroundColor = 'transparent';
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#000000';
    document.head.appendChild(meta);
    await Promise.resolve();
    jest.advanceTimersByTime(300);
    expect(latest().color).toBe('rgb(0, 0, 0)');
    meta.content = '#ffffff';
    await Promise.resolve();
    jest.advanceTimersByTime(300);
    expect(latest().color).toBe('rgb(255, 255, 255)');
  });
});
