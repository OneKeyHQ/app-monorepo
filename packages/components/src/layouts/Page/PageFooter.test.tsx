/** @jest-environment jsdom */

import {
  StrictMode,
  Suspense,
  startTransition,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { PageContainer } from './PageContainer';
import { PageContainer as NativePageContainer } from './PageContainer.native';
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
  usePropsAndStyle: () => [{}, {}],
  useStyle: () => ({}),
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
jest.mock('./BasicPage', () => ({
  BasicPage: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock('../ScrollView', () => ({
  ScrollView: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ScrollViewRefProvider: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardAwareScrollView: ({
    children,
    extraKeyboardSpace,
  }: {
    children: ReactNode;
    extraKeyboardSpace: number;
  }) => (
    <div data-testid="keyboard-scroll" data-extra={extraKeyboardSpace}>
      {children}
    </div>
  ),
  useKeyboardState: (selector: (state: { height: number }) => number) =>
    selector({ height: 300 }),
}));
jest.mock('../../content/Keyboard', () => ({
  KEYBOARD_AWARE_SCROLL_BOTTOM_OFFSET: 0,
}));

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
        () => ({
          enabled: true,
          children: <div data-testid="footer">{mode}</div>,
        }),
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

describe.each([
  ['web', PageContainer],
  ['native', NativePageContainer],
])('%s PageContainer', (_platform, Container) => {
  function TestPage({
    label,
    direct,
    showFooter = true,
    onCommit,
  }: {
    label: string;
    direct?: boolean;
    showFooter?: boolean;
    onCommit?: (label: string, footer: string | null) => void;
  }) {
    const footerRef = useRef<IPageFooterRef>({});
    const context = useMemo(() => ({ footerRef }), [footerRef]);
    const directFooter = useMemo(
      () =>
        direct === undefined
          ? undefined
          : {
              enabled: direct,
              children: <div data-testid="content">{label}</div>,
            },
      [direct, label],
    );
    function Body() {
      useLayoutEffect(() => {
        onCommit?.(label, screen.queryByTestId('content')?.textContent ?? null);
      });
      return <div>body</div>;
    }
    return (
      <PageContext.Provider value={context}>
        <Container directFooter={directFooter}>
          <Body />
          {showFooter && !direct ? (
            <PageFooter>
              <div data-testid="content">{label}</div>
            </PageFooter>
          ) : null}
        </Container>
      </PageContext.Provider>
    );
  }

  it('keeps the registered footer as the default through updates and removal', () => {
    const { rerender } = render(<TestPage label="first" />);
    expect(screen.getByTestId('content').textContent).toBe('first');
    rerender(<TestPage label="updated" />);
    expect(screen.getByTestId('content').textContent).toBe('updated');
    rerender(<TestPage label="updated" showFooter={false} />);
    expect(screen.queryByTestId('content')).toBeNull();
  });

  it('does not enable the direct footer when enabled is omitted', () => {
    function TestDefault() {
      const footerRef = useRef<IPageFooterRef>({});
      const context = useMemo(() => ({ footerRef }), [footerRef]);
      const footer = useMemo(() => ({ children: <div>direct</div> }), []);
      return (
        <PageContext.Provider value={context}>
          <Container directFooter={footer}>
            <PageFooter>registered</PageFooter>
          </Container>
        </PageContext.Provider>
      );
    }
    render(<TestDefault />);
    expect(screen.getByText('registered')).toBeTruthy();
    expect(screen.queryByText('direct')).toBeNull();
  });

  it('switches between the registered and explicitly enabled footer', () => {
    const consoleError = jest.spyOn(console, 'error');
    const onCommit = jest.fn();
    const { rerender } = render(
      <TestPage label="registered" direct={false} onCommit={onCommit} />,
    );
    rerender(<TestPage label="direct" direct onCommit={onCommit} />);
    expect(screen.getByTestId('content').textContent).toBe('direct');
    rerender(
      <TestPage label="registered again" direct={false} onCommit={onCommit} />,
    );
    expect(screen.getByTestId('content').textContent).toBe('registered again');
    expect(onCommit).toHaveBeenCalledWith(
      'registered again',
      'registered again',
    );
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('removes the direct footer when disabled without a registered footer', () => {
    const { rerender } = render(
      <TestPage label="direct" direct showFooter={false} />,
    );
    expect(screen.getByTestId('content').textContent).toBe('direct');
    rerender(<TestPage label="disabled" direct={false} showFooter={false} />);
    expect(screen.queryByTestId('content')).toBeNull();
  });

  it('restores a continuously registered footer when direct mode is disabled', () => {
    function TestRegistered({ direct }: { direct: boolean }) {
      const footerRef = useRef<IPageFooterRef>({});
      const context = useMemo(() => ({ footerRef }), [footerRef]);
      const footer = useMemo(
        () => ({ enabled: direct, children: <div>direct</div> }),
        [direct],
      );
      const registered = useMemo(() => <PageFooter>registered</PageFooter>, []);
      return (
        <PageContext.Provider value={context}>
          <Container directFooter={footer}>{registered}</Container>
        </PageContext.Provider>
      );
    }
    const { rerender } = render(<TestRegistered direct />);
    expect(screen.getByText('direct')).toBeTruthy();
    rerender(<TestRegistered direct={false} />);
    expect(screen.queryByText('direct')).toBeNull();
    expect(screen.getByText('registered')).toBeTruthy();
  });

  it('switches footer paths under StrictMode', () => {
    const onCommit = jest.fn();
    const { rerender } = render(
      <StrictMode>
        <TestPage label="registered" direct={false} onCommit={onCommit} />
      </StrictMode>,
    );
    rerender(
      <StrictMode>
        <TestPage label="direct" direct onCommit={onCommit} />
      </StrictMode>,
    );
    expect(screen.getByTestId('content').textContent).toBe('direct');
    rerender(
      <StrictMode>
        <TestPage label="registered again" direct={false} onCommit={onCommit} />
      </StrictMode>,
    );
    expect(screen.getByTestId('content').textContent).toBe('registered again');
    expect(onCommit).toHaveBeenCalledWith(
      'registered again',
      'registered again',
    );
  });

  it('does not show an uncommitted footer after a suspended transition', () => {
    const suspended = jest.fn();
    const pending = new Promise<void>(() => {});
    function Suspend(): never {
      suspended();
      throw pending;
    }
    function TestTransition() {
      const [mode, setMode] = useState<'direct' | 'suspended' | 'empty'>(
        'direct',
      );
      const footerRef = useRef<IPageFooterRef>({});
      const context = useMemo(() => ({ footerRef }), [footerRef]);
      const footer = useMemo(
        () => ({ enabled: true, children: <div>direct</div> }),
        [],
      );
      const suspend = useCallback(() => {
        startTransition(() => setMode('suspended'));
      }, []);
      const empty = useCallback(() => setMode('empty'), []);
      const fallback = useMemo(() => <div>loading</div>, []);
      return (
        <PageContext.Provider value={context}>
          <button onClick={suspend}>suspend</button>
          <button onClick={empty}>empty</button>
          <Suspense fallback={fallback}>
            <Container directFooter={mode === 'direct' ? footer : undefined}>
              {mode === 'suspended' ? (
                <>
                  <PageFooter>uncommitted</PageFooter>
                  <Suspend />
                </>
              ) : null}
            </Container>
          </Suspense>
        </PageContext.Provider>
      );
    }
    render(<TestTransition />);
    fireEvent.click(screen.getByText('suspend'));
    expect(suspended).toHaveBeenCalled();
    fireEvent.click(screen.getByText('empty'));
    expect(screen.queryByText('uncommitted')).toBeNull();
  });
});

it('retains native keyboard inset handling when direct footer is enabled or disabled', () => {
  function TestPage({
    direct,
    disableKeyboardAnimation = false,
  }: {
    direct: boolean;
    disableKeyboardAnimation?: boolean;
  }) {
    const footerRef = useRef<IPageFooterRef>({});
    const context = useMemo(
      () => ({ footerRef, scrollEnabled: true }),
      [footerRef],
    );
    const footer = useMemo(
      () => ({
        enabled: direct,
        children: <div>footer</div>,
        disableKeyboardAnimation,
      }),
      [direct, disableKeyboardAnimation],
    );
    return (
      <PageContext.Provider value={context}>
        <NativePageContainer directFooter={footer}>
          {direct ? null : <PageFooter>footer</PageFooter>}
        </NativePageContainer>
      </PageContext.Provider>
    );
  }

  const { rerender } = render(<TestPage direct={false} />);
  expect(screen.getByTestId('keyboard-scroll').getAttribute('data-extra')).toBe(
    '-300',
  );
  rerender(<TestPage direct />);
  expect(screen.getByTestId('keyboard-scroll').getAttribute('data-extra')).toBe(
    '-300',
  );
  rerender(<TestPage direct disableKeyboardAnimation />);
  expect(screen.getByTestId('keyboard-scroll').getAttribute('data-extra')).toBe(
    '0',
  );
  rerender(<TestPage direct={false} />);
  expect(screen.getByTestId('keyboard-scroll').getAttribute('data-extra')).toBe(
    '-300',
  );
});
