/** @jest-environment jsdom */

import { useMemo, useRef } from 'react';
import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import type { IPageFooterRef } from '@onekeyhq/components/src/layouts/Page/PageContext';
import { PercentageStageOnKeyboard } from '@onekeyhq/kit/src/components/PercentageStageOnKeyboard';

import { useAmountInputFocus } from './useAmountInputFocus';

const { PageContext } = jest.requireActual<
  typeof import('@onekeyhq/components/src/layouts/Page/PageContext')
>(`${process.cwd()}/packages/components/src/layouts/Page/PageContext`);
const { BasicPageFooter, PageFooter } = jest.requireActual<
  typeof import('@onekeyhq/components/src/layouts/Page/PageFooter')
>(`${process.cwd()}/packages/components/src/layouts/Page/PageFooter`);

jest.mock('react-native', () => ({
  Keyboard: {
    isVisible: () => true,
    addListener: () => ({ remove: () => undefined }),
  },
}));

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {
    View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  },
  useAnimatedStyle: () => ({}),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, isNativeAndroid: true },
}));

jest.mock('@onekeyhq/components', () => ({
  XStack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useIsKeyboardShown: () => false,
  useMedia: () => ({ gtMd: false }),
}));

jest.mock('../../../../components/src/hooks/useStyle', () => ({
  useMedia: () => ({ gtMd: false }),
}));

jest.mock('../../../../components/src/hooks/useKeyboardController', () => ({
  useReanimatedKeyboardAnimation: () => ({
    height: { value: 0 },
    progress: { value: 0 },
  }),
}));

jest.mock('../../../../components/src/optimization', () => ({
  OptimizationView: () => null,
}));

jest.mock('../../../../components/src/layouts/Page/hooks', () => ({
  usePageFooterSafeAreaBottom: () => 0,
  usePageFooterTabBarHeight: () => 0,
  useSafeAreaBottom: () => 0,
}));

jest.mock('../../../../components/src/layouts/Page/PageFooterActions', () => ({
  FooterActions: () => null,
}));

jest.mock('./PercentageStageRow', () => ({
  PercentageStageRow: () => <span>percentage stages</span>,
}));

function Form({ name }: { name: string }) {
  const { isAmountFocused, onAmountFocusChange } = useAmountInputFocus();
  return (
    <>
      <button onClick={() => onAmountFocusChange(name, true)} type="button">
        Focus {name}
      </button>
      <button onClick={() => onAmountFocusChange(name, false)} type="button">
        Blur {name}
      </button>
      <PageFooter>
        <PercentageStageOnKeyboard isAmountFocused={isAmountFocused} />
      </PageFooter>
    </>
  );
}

function Page({ name }: { name: string }) {
  const footerRef = useRef<IPageFooterRef>({});
  const pageContext = useMemo(() => ({ footerRef }), []);
  return (
    <PageContext.Provider value={pageContext}>
      <Form key={name} name={name} />
      <BasicPageFooter />
    </PageContext.Provider>
  );
}

describe('Android Earn percentage footer bridge', () => {
  it('updates from the form focus and a new page sees the already open keyboard', () => {
    const view = render(<Page key="first" name="first" />);
    expect(screen.queryByText('percentage stages')).toBeNull();

    fireEvent.click(screen.getByText('Focus first'));
    expect(screen.getByText('percentage stages')).toBeTruthy();

    view.rerender(<Page key="second" name="second" />);
    expect(screen.queryByText('percentage stages')).toBeNull();

    fireEvent.click(screen.getByText('Focus second'));
    expect(screen.getByText('percentage stages')).toBeTruthy();

    fireEvent.click(screen.getByText('Blur second'));
    expect(screen.queryByText('percentage stages')).toBeNull();
  });

  it('updates the same page footer when a tab replaces its amount form', () => {
    const view = render(<Page name="first" />);
    fireEvent.click(screen.getByText('Focus first'));
    expect(screen.getByText('percentage stages')).toBeTruthy();

    view.rerender(<Page name="second" />);
    expect(screen.queryByText('percentage stages')).toBeNull();
    fireEvent.click(screen.getByText('Focus second'));
    expect(screen.getByText('percentage stages')).toBeTruthy();
  });
});
