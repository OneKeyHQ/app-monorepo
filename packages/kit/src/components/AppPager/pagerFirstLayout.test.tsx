/** @jest-environment jsdom */

import { forwardRef } from 'react';
import type {
  CSSProperties,
  ComponentType,
  PropsWithChildren,
  ReactNode,
} from 'react';

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { runInNewContext } from 'node:vm';

import { transformSync } from '@swc/core';
import { render } from '@testing-library/react';

type IPagerProps = PropsWithChildren<{
  header: ReactNode;
  stickyHeader: ReactNode;
}>;

const View = forwardRef<
  HTMLDivElement,
  PropsWithChildren<{ style?: CSSProperties | CSSProperties[] }>
>(({ children, style }, ref) => (
  <div ref={ref} style={Object.assign({}, ...[style].flat())}>
    {children}
  </div>
));
View.displayName = 'PagerTestView';

// Exercise the installed SDK's lifecycle and DOM insets before any animation
// frame runs, including its shipped JS entry rather than only its TS source.
function loadPager(relativePath: string) {
  const root = dirname(require.resolve('react-native-pager-view/package.json'));
  const filename = join(root, relativePath);
  const { code } = transformSync(readFileSync(filename, 'utf8'), {
    filename,
    jsc: { parser: { syntax: 'typescript', tsx: true } },
    module: { type: 'commonjs' },
  });
  const module = {
    exports: {} as { CollapsiblePagerView: ComponentType<IPagerProps> },
  };
  runInNewContext(
    code,
    {
      module,
      exports: module.exports,
      require: (name: string) => {
        if (name === 'react-native') {
          return {
            View,
            StyleSheet: { create: (styles: object) => styles },
            Platform: { OS: 'web' },
            I18nManager: { isRTL: false },
          };
        }
        if (
          name === './WebCollapsiblePagerPage' ||
          name === './WebCollapsiblePagerPage.js'
        ) {
          return {
            WebCollapsiblePagerPage: ({ children }: PropsWithChildren) =>
              children,
          };
        }
        if (name === '@onekeyfe/react-native-image/icon/dom') {
          return { createNamedIcon: () => null };
        }
        // The SDK's compiled JSX shares the test renderer's React instance.
        return require(name) as unknown;
      },
      document,
      HTMLElement,
      ResizeObserver: class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
      requestAnimationFrame,
      cancelAnimationFrame,
      setTimeout,
      clearTimeout,
    },
    { filename },
  );
  return module.exports.CollapsiblePagerView;
}

it.each([
  'src/CollapsiblePagerView.web.tsx',
  'lib/module/CollapsiblePagerView.web.js',
])('reserves banner and sticky space before the first paint (%s)', (entry) => {
  jest.useFakeTimers();
  let bannerHeight = 224;
  jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation(function (this: HTMLElement) {
      const childId = (this.firstElementChild as HTMLElement | null)?.dataset
        .testid;
      let height = 600;
      if (childId === 'banner') height = bannerHeight;
      else if (childId === 'tabs') height = 108;
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 1440,
        bottom: height,
        width: 1440,
        height,
        toJSON: () => ({}),
      };
    });
  try {
    const Pager = loadPager(entry);
    const content = () => (
      <Pager
        header={<div data-testid="banner" />}
        stickyHeader={<div data-testid="tabs" />}
      >
        <div key="market" data-collapsible-pager-scroll="true">
          <div data-testid="list-content" />
        </div>
      </Pager>
    );
    const screen = render(content());
    const owner = screen.getByTestId('list-content').parentElement;
    expect(owner?.getAttribute('data-collapsible-pager-active')).toBe('true');
    expect(
      owner?.style.getPropertyValue('--ok-collapsible-pager-header-inset'),
    ).toBe('224px');
    expect(
      owner?.style.getPropertyValue('--ok-collapsible-pager-sticky-inset'),
    ).toBe('108px');
    bannerHeight = 232;
    screen.rerender(content());
    expect(
      owner?.style.getPropertyValue('--ok-collapsible-pager-header-inset'),
    ).toBe('232px');
    screen.unmount();
  } finally {
    jest.restoreAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  }
});
