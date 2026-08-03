import { type ReactNode, StrictMode, useMemo, useRef } from 'react';

import { act, render } from '@testing-library/react-native';

import { type IPageFooterRef, PageContext } from './PageContext';
import { BasicPageFooter, PageFooter } from './PageFooter';

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {
    View: ({ children }: { children?: ReactNode }) => {
      const react = jest.requireActual<typeof import('react')>('react');
      return react.createElement(
        'View',
        { testID: 'page-footer-content' },
        children,
      );
    },
  },
  useAnimatedStyle: () => ({}),
}));

jest.mock('@onekeyhq/components/src/hooks/useStyle', () => ({
  useMedia: () => ({ gtMd: true }),
}));

jest.mock('../../hooks/useKeyboardController', () => ({
  useReanimatedKeyboardAnimation: () => ({ height: { value: 0 } }),
}));

jest.mock('../../optimization', () => ({
  OptimizationView: ({ children }: { children?: ReactNode }) =>
    children ?? null,
}));

jest.mock('./hooks', () => ({
  useSafeAreaBottom: () => 0,
  useTabBarHeight: () => 0,
}));

jest.mock('./PageFooterActions', () => ({
  FooterActions: () => null,
}));

function FooterHarness({ visible }: { visible: boolean }) {
  const footerRef = useRef<IPageFooterRef>({});
  const contextValue = useMemo(
    () => ({ footerRef, safeAreaEnabled: false, scrollEnabled: false }),
    [],
  );
  return (
    <PageContext.Provider value={contextValue}>
      {visible ? <PageFooter /> : null}
      <BasicPageFooter />
    </PageContext.Provider>
  );
}

function hasFooterContent(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(hasFooterContent);
  }
  if (!value || typeof value !== 'object') {
    return false;
  }
  const node = value as {
    children?: unknown;
    props?: Record<string, unknown>;
  };
  return (
    node.props?.testID === 'page-footer-content' ||
    hasFooterContent(node.children)
  );
}

describe('PageFooter committed updates', () => {
  it('seeds the first mounted footer before BasicPageFooter renders', () => {
    const screen = render(<FooterHarness visible />);
    expect(hasFooterContent(screen.toJSON())).toBe(true);
  });

  it('toggles false to true to false without a render-phase update warning', () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const screen = render(
      <StrictMode>
        <FooterHarness visible={false} />
      </StrictMode>,
    );
    expect(hasFooterContent(screen.toJSON())).toBe(false);

    act(() => {
      screen.rerender(
        <StrictMode>
          <FooterHarness visible />
        </StrictMode>,
      );
    });
    expect(hasFooterContent(screen.toJSON())).toBe(true);

    act(() => {
      screen.rerender(
        <StrictMode>
          <FooterHarness visible={false} />
        </StrictMode>,
      );
    });
    expect(hasFooterContent(screen.toJSON())).toBe(false);
    expect(
      consoleError.mock.calls.some((args) =>
        args.some(
          (arg) =>
            typeof arg === 'string' &&
            arg.includes('Cannot update a component'),
        ),
      ),
    ).toBe(false);
    consoleError.mockRestore();
  });
});
