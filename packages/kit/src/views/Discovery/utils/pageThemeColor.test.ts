/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import {
  applyCachedPageThemeColor,
  clearPageColors,
  documentUrlOf,
  isNewDocumentLoad,
  tryDispatchPageThemeMessage,
  usePageBottomColor,
  usePageTheme,
} from './pageThemeColor';

const TAB = 'tab-1';

function reportColors(color: string, bottomColor: string, pageUrl: string) {
  return tryDispatchPageThemeMessage(
    TAB,
    JSON.stringify({
      type: '$onekeyPageThemeColor',
      color,
      bottomColor,
    }),
    pageUrl,
  );
}

function renderColors() {
  return renderHook(() => ({
    top: usePageTheme(TAB).pageColor,
    bottom: usePageBottomColor(TAB),
  }));
}

beforeEach(() => {
  clearPageColors(TAB);
});

describe('applyCachedPageThemeColor', () => {
  it('drops the page bottom color and falls back to the top color', () => {
    const { result } = renderColors();

    act(() => {
      reportColors('rgb(0, 0, 0)', 'rgb(10, 10, 10)', 'https://a.example.com/');
    });
    expect(result.current.bottom).toBe('rgb(10, 10, 10)');

    act(() => {
      applyCachedPageThemeColor(TAB, 'https://b.example.com/');
    });

    // The top color stays until the destination reports, and the bottom color of
    // the page just left must not drive the bar's icon contrast any more.
    expect(result.current.top).toBe('rgb(0, 0, 0)');
    expect(result.current.bottom).toBe('rgb(0, 0, 0)');
  });

  it('applies the destination cached color over the previous page colors', () => {
    const { result } = renderColors();

    // Visit the light page first so its origin is cached.
    act(() => {
      reportColors(
        'rgb(255, 255, 255)',
        'rgb(250, 250, 250)',
        'https://light.example.com/',
      );
    });
    act(() => {
      reportColors(
        'rgb(0, 0, 0)',
        'rgb(12, 12, 12)',
        'https://dark.example.com/',
      );
    });
    expect(result.current.bottom).toBe('rgb(12, 12, 12)');

    act(() => {
      applyCachedPageThemeColor(TAB, 'https://light.example.com/');
    });

    expect(result.current.top).toBe('rgb(255, 255, 255)');
    expect(result.current.bottom).toBe('rgb(255, 255, 255)');
  });

  it('notifies subscribers when only the bottom color has to be dropped', () => {
    const { result } = renderColors();

    act(() => {
      reportColors(
        'rgb(30, 30, 30)',
        'rgb(40, 40, 40)',
        'https://c.example.com/',
      );
    });

    act(() => {
      // Same origin, so the cached top color equals the current one; dropping the
      // stale bottom color alone must still re-render the chrome.
      applyCachedPageThemeColor(TAB, 'https://c.example.com/');
    });

    expect(result.current.top).toBe('rgb(30, 30, 30)');
    expect(result.current.bottom).toBe('rgb(30, 30, 30)');
  });

  it('keeps the bottom color for a same-document navigation', () => {
    const { result } = renderColors();

    // A dark header over a light body: the bar reads its contrast from the
    // bottom, which differs from the top on purpose.
    act(() => {
      reportColors(
        'rgb(0, 0, 0)',
        'rgb(250, 250, 250)',
        'https://d.example.com/',
      );
    });
    expect(result.current.bottom).toBe('rgb(250, 250, 250)');

    act(() => {
      // An anchor jump, or Android reporting a same-document history update.
      // The document does not reload, so it will not report again and the
      // bottom color has to survive.
      applyCachedPageThemeColor(TAB, 'https://d.example.com/#section', false);
    });

    expect(result.current.top).toBe('rgb(0, 0, 0)');
    expect(result.current.bottom).toBe('rgb(250, 250, 250)');
  });
});

describe('isNewDocumentLoad', () => {
  const DARK = 'rgb(0, 0, 0)';
  const LIGHT = 'rgb(250, 250, 250)';
  const PAGE = 'https://example.com/page';
  const page = { top: DARK, bottom: LIGHT };

  function decide({
    url,
    previousDocumentUrl = documentUrlOf(PAGE),
    loading,
    isAndroid = false,
  }: {
    url: string;
    previousDocumentUrl?: string;
    loading?: boolean;
    isAndroid?: boolean;
  }) {
    return isNewDocumentLoad({ url, previousDocumentUrl, loading, isAndroid });
  }

  it('treats the first load as a new document', () => {
    expect(decide({ url: PAGE, previousDocumentUrl: '' })).toBe(true);
    expect(decide({ url: '', previousDocumentUrl: '' })).toBe(false);
  });

  it('treats a hash change as the same document', () => {
    expect(decide({ url: `${PAGE}#section` })).toBe(false);
    expect(decide({ url: `${PAGE}#`, previousDocumentUrl: PAGE })).toBe(false);
  });

  it('treats a different path as a new document', () => {
    expect(decide({ url: `${PAGE}-2` })).toBe(true);
    expect(decide({ url: 'https://example.com/other' })).toBe(true);
    expect(decide({ url: 'https://other.example.com/page' })).toBe(true);
  });

  it('skips Android same-document history updates', () => {
    // Android reports a same-document history update as a load-start with
    // loading === false, and its URL can differ from the document's.
    expect(
      decide({
        url: 'https://example.com/other',
        loading: false,
        isAndroid: true,
      }),
    ).toBe(false);
    // A real Android navigation keeps loading true and counts as a new document.
    expect(
      decide({
        url: 'https://example.com/other',
        loading: true,
        isAndroid: true,
      }),
    ).toBe(true);
    // iOS has no such reporting, so loading is not consulted there.
    expect(
      decide({
        url: 'https://example.com/other',
        loading: false,
        isAndroid: false,
      }),
    ).toBe(true);
  });

  it('treats a hash change as the same document after an SPA route change', () => {
    // iOS reports a pushState route change as a load-finish, which syncs the
    // baseline; the anchor jump that follows is then the same document.
    const routeB = 'https://example.com/b';
    expect(
      decide({ url: `${routeB}#section`, previousDocumentUrl: routeB }),
    ).toBe(false);
    // Before the baseline was synced, the same jump compared against the old
    // route and looked like a new document.
    expect(
      decide({ url: `${routeB}#section`, previousDocumentUrl: PAGE }),
    ).toBe(true);
  });

  it('keeps the bottom color coherent with the retained top color', () => {
    const { result } = renderColors();
    act(() => {
      reportColors(page.top, page.bottom, PAGE);
    });

    // Same document: both colors stay, so the bar keeps the page's own contrast.
    act(() => {
      applyCachedPageThemeColor(TAB, `${PAGE}#section`, false);
    });
    expect(result.current.top).toBe(page.top);
    expect(result.current.bottom).toBe(page.bottom);
  });

  it('does not pull another tab origin cache into the current document', () => {
    const OTHER_TAB = 'tab-2';
    const { result } = renderColors();

    act(() => {
      // A dark page in this tab.
      reportColors(page.top, page.bottom, PAGE);
      // Another tab on the same origin reports a different color, which lands in
      // the per-origin cache.
      tryDispatchPageThemeMessage(
        OTHER_TAB,
        JSON.stringify({
          type: '$onekeyPageThemeColor',
          color: 'rgb(200, 200, 200)',
          bottomColor: 'rgb(190, 190, 190)',
        }),
        PAGE,
      );
    });

    act(() => {
      // An anchor jump in the first tab must not adopt the other tab's color.
      applyCachedPageThemeColor(TAB, `${PAGE}#section`, false);
    });

    expect(result.current.top).toBe(page.top);
    expect(result.current.bottom).toBe(page.bottom);

    // A real navigation does apply that origin's cache.
    act(() => {
      applyCachedPageThemeColor(TAB, PAGE);
    });
    expect(result.current.top).toBe('rgb(200, 200, 200)');
  });
});
