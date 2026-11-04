/** @jest-environment jsdom */

import { useLayoutEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import { PageContext } from './PageContext';
import { BasicPageFooter, PageFooter } from './PageFooter';

import type { IPageFooterRef } from './PageContext';

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {
    View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  },
  useAnimatedStyle: () => ({}),
}));
jest.mock('@onekeyhq/components/src/hooks/useStyle', () => ({
  useMedia: () => ({ gtMd: false }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('../../hooks/useKeyboardController', () => ({
  useReanimatedKeyboardAnimation: () => ({
    height: { value: 0 },
    progress: { value: 0 },
  }),
}));
jest.mock('../../optimization', () => ({ OptimizationView: () => null }));
jest.mock('./hooks', () => ({
  usePageFooterSafeAreaBottom: () => 0,
  usePageFooterTabBarHeight: () => 0,
  useSafeAreaBottom: () => 0,
}));
jest.mock('./PageFooterActions', () => ({ FooterActions: () => null }));

describe('Page footer', () => {
  it('updates a direct footer in the same commit as the page body', () => {
    const snapshots: string[] = [];

    function Body({ mode }: { mode: string }) {
      useLayoutEffect(() => {
        snapshots.push(`${mode}/${screen.getByTestId('footer').textContent}`);
      }, [mode]);
      return <div>{mode}</div>;
    }

    function TestPage({ mode }: { mode: string }) {
      const footerRef = useRef<IPageFooterRef>({});
      const context = useMemo(() => ({ footerRef }), [footerRef]);
      const footer = useMemo(
        () => ({ children: <div data-testid="footer">{mode}</div> }),
        [mode],
      );
      return (
        <PageContext.Provider value={context}>
          <Body mode={mode} />
          <BasicPageFooter directProps={footer} />
        </PageContext.Provider>
      );
    }

    const { rerender } = render(<TestPage mode="regular" />);
    rerender(<TestPage mode="private" />);
    rerender(<TestPage mode="regular" />);

    expect(snapshots).toEqual([
      'regular/regular',
      'private/private',
      'regular/regular',
    ]);
  });

  it('continues to render registered Page.Footer content', () => {
    function TestPage({ label }: { label: string }) {
      const footerRef = useRef<IPageFooterRef>({});
      const context = useMemo(() => ({ footerRef }), [footerRef]);
      return (
        <PageContext.Provider value={context}>
          <PageFooter>
            <div>{label}</div>
          </PageFooter>
          <BasicPageFooter />
        </PageContext.Provider>
      );
    }

    const { rerender } = render(<TestPage label="regular" />);
    expect(screen.getByText('regular')).toBeTruthy();
    rerender(<TestPage label="private" />);
    expect(screen.getByText('private')).toBeTruthy();
  });
});
