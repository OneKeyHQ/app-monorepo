/** @jest-environment jsdom */
// Covers the injected page script's scroll throttle, which decides how often
// the page is measured. Each read hit-tests the bottom once and the top edge
// at several x positions (PAGE_THEME_HIT_TESTS_PER_READ). Counting posted
// messages would miss reads whose result is unchanged (the script drops
// duplicate reports).
import {
  PAGE_THEME_COLOR_SCRIPT,
  PAGE_THEME_HIT_TESTS_PER_READ,
} from './pageThemeColor';

const CALLS_PER_READ = PAGE_THEME_HIT_TESTS_PER_READ;

const SETTLE_MS = 150;
const MAX_WAIT_MS = 1000;

const elementsFromPoint = jest.fn(() => [document.body]);

function advanceTo(target: number) {
  jest.advanceTimersByTime(target - Date.now());
}

function scroll() {
  globalThis.dispatchEvent(new Event('scroll'));
}

// Clock time of the next test, far enough past the previous one that no burst
// or timer carries over.
function startTest() {
  const start = Date.now() + 10_000;
  advanceTo(start);
  elementsFromPoint.mockClear();
  return start;
}

beforeAll(() => {
  jest.useFakeTimers({ now: 0 });

  // jsdom has no hit testing or matchMedia; the script would throw on either,
  // which its own try/catch swallows before the scroll listener is registered.
  Object.assign(document, {
    elementFromPoint: () => document.body,
    elementsFromPoint,
  });
  Object.assign(globalThis, {
    matchMedia: () => ({ matches: false, addEventListener: () => {} }),
    ReactNativeWebView: { postMessage: jest.fn() },
  });
  document.body.style.backgroundColor = 'rgb(10, 20, 30)';
  // jest-setup stubs the global addEventListener, which would drop the
  // script's scroll listener.
  globalThis.addEventListener =
    EventTarget.prototype.addEventListener.bind(globalThis);

  // The script is a string injected into WebViews; this is how it runs there.
  // eslint-disable-next-line no-new-func, @typescript-eslint/no-implied-eval
  const runScript = new Function(PAGE_THEME_COLOR_SCRIPT) as () => void;
  runScript();
  // Let the load-time reads (immediate and the 800ms re-read) go by.
  advanceTo(2000);
});

afterAll(() => {
  jest.useRealTimers();
});

describe('PAGE_THEME_COLOR_SCRIPT scroll throttle', () => {
  // First, so it starts with no earlier burst in the script's state.
  it('still reads after a burst whose last event hit the max wait', () => {
    const start = startTest();

    for (let t = 0; t < MAX_WAIT_MS; t += 100) {
      advanceTo(start + t);
      scroll();
    }
    advanceTo(start + MAX_WAIT_MS);
    scroll();
    expect(elementsFromPoint).toHaveBeenCalledTimes(CALLS_PER_READ);

    // That read ran before the page's own scroll handlers; the layout they
    // settle on still has to be read.
    advanceTo(start + MAX_WAIT_MS + SETTLE_MS + 10);
    expect(elementsFromPoint).toHaveBeenCalledTimes(2 * CALLS_PER_READ);
  });

  it('reads once a scroll settles, not during it', () => {
    const start = startTest();

    // A 500ms drag, one event per frame.
    for (let t = 0; t <= 500; t += 16) {
      advanceTo(start + t);
      scroll();
    }
    expect(elementsFromPoint).toHaveBeenCalledTimes(0);
    advanceTo(start + 500 + SETTLE_MS + 10);
    expect(elementsFromPoint).toHaveBeenCalledTimes(CALLS_PER_READ);
  });

  it('does not read on the first event of a later gesture', () => {
    const start = startTest();

    for (let t = 0; t <= 200; t += 16) {
      advanceTo(start + t);
      scroll();
    }
    advanceTo(start + 200 + SETTLE_MS + 10);
    expect(elementsFromPoint).toHaveBeenCalledTimes(CALLS_PER_READ);

    // A second gesture more than one max wait later: the first burst's start
    // must have been cleared, so this event only schedules a read.
    advanceTo(start + 200 + SETTLE_MS + 10 + MAX_WAIT_MS + 100);
    scroll();
    expect(elementsFromPoint).toHaveBeenCalledTimes(CALLS_PER_READ);
  });

  it('keeps reading about once a second while a scroller never stops', () => {
    const start = startTest();

    for (let t = 0; t <= 5000; t += 16) {
      advanceTo(start + t);
      scroll();
    }
    // One read per max-wait window, where a plain debounce would never read.
    expect(elementsFromPoint.mock.calls.length).toBeGreaterThanOrEqual(
      4 * CALLS_PER_READ,
    );
    expect(elementsFromPoint.mock.calls.length).toBeLessThanOrEqual(
      6 * CALLS_PER_READ,
    );

    // The burst still ends with a trailing read once it stops.
    const duringBurst = elementsFromPoint.mock.calls.length;
    advanceTo(start + 5000 + SETTLE_MS + 10);
    expect(elementsFromPoint).toHaveBeenCalledTimes(
      duringBurst + CALLS_PER_READ,
    );
  });
});
