/**
 * @jest-environment jsdom
 */

import type { ReactNode } from 'react';

import { act, render, screen } from '@testing-library/react';

import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { MDHeader } from './MDHeader';

let mockWindowX = 0;
let mockWindowLeft = 100;
let mockDimensions = { width: 1200, height: 800 };
let mockDeferMeasurement = false;
let mockMeasurements: ((x: number) => void)[] = [];
let mockOnLayout: (() => void) | undefined;

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeIOS: true },
}));

jest.mock('react-native', () => ({
  useWindowDimensions: () => mockDimensions,
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Host = React.forwardRef(
    (
      { children, onLayout }: { children?: ReactNode; onLayout?: () => void },
      ref,
    ) => {
      if (onLayout) mockOnLayout = onLayout;
      React.useImperativeHandle(ref, () => ({
        measureInWindow: (callback: (x: number) => void) => {
          if (mockDeferMeasurement) mockMeasurements.push(callback);
          else callback(mockWindowX);
        },
      }));
      return <div>{children}</div>;
    },
  );
  Host.displayName = 'HeaderHost';
  return {
    View: Host,
    YStack: Host,
    XStack: ({ children, ml }: { children?: ReactNode; ml?: number }) => (
      <div
        data-testid={ml === undefined ? undefined : 'header-row'}
        data-margin={ml}
      >
        {children}
      </div>
    ),
    GlassButtonCapsule: () => null,
    Page: { Header: () => null },
    isLiquidGlassAvailable: () => false,
    useSafeAreaInsets: () => ({ top: 0 }),
  };
});

jest.mock('@onekeyhq/shared/src/modules/WindowControlsInsets', () => ({
  useWindowControlsLeadingOffset: (padding: number) =>
    Math.max(0, mockWindowLeft - padding),
}));
jest.mock('../../states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({ activeAccount: {} }),
  useIsAccountSelectorSyncLoading: () => false,
}));
jest.mock(
  '../../views/Home/components/HomeTokenListProvider/HomeTokenListProviderMirror',
  () => ({
    HomeTokenListProviderMirror: ({ children }: { children?: ReactNode }) =>
      children,
  }),
);
jest.mock('../MoreActionButton/LazyMoreActionButton', () => ({
  LazyMoreActionButton: () => null,
}));
jest.mock('./components/HeaderNotificationIconButton', () => ({
  HeaderNotificationIconButton: () => null,
}));
jest.mock('./components/HeaderUpdateButton', () => ({
  HeaderUpdateButton: () => null,
}));
jest.mock('./HeaderLeft', () => ({ HeaderLeft: () => null }));
jest.mock('./HeaderMDSearch', () => ({ HeaderMDSearch: () => null }));
jest.mock('./HeaderRight', () => ({
  HeaderRight: () => null,
  SelectorTrigger: () => null,
}));
jest.mock('./HeaderTitle', () => ({ HeaderTitle: () => null }));
jest.mock('./LegacyUniversalSearchInput', () => ({
  LegacyUniversalSearchInput: () => null,
}));

function AddressHeader({
  sceneName = EAccountSelectorSceneName.homeUrlAccount,
}: {
  sceneName?: EAccountSelectorSceneName;
}) {
  return (
    <MDHeader tabRoute={ETabRoutes.Home} sceneName={sceneName} hideSearch />
  );
}

function margin() {
  return Number(screen.getByTestId('header-row').getAttribute('data-margin'));
}

describe('MDHeader window controls', () => {
  beforeEach(() => {
    mockWindowX = 0;
    mockWindowLeft = 100;
    mockDimensions = { width: 1200, height: 800 };
    mockDeferMeasurement = false;
    mockMeasurements = [];
    mockOnLayout = undefined;
  });

  it.each([
    EAccountSelectorSceneName.home,
    EAccountSelectorSceneName.homeUrlAccount,
  ])(
    'keeps the window edge offset and removes it in the detail pane for %s',
    (sceneName) => {
      const { rerender } = render(<AddressHeader sceneName={sceneName} />);
      expect(margin()).toBe(80);

      mockWindowX = 600;
      mockDimensions = { width: 1202, height: 800 };
      rerender(<AddressHeader sceneName={sceneName} />);
      expect(margin()).toBe(0);

      mockWindowX = 0;
      act(() => mockOnLayout?.());
      expect(margin()).toBe(80);
    },
  );

  it('only offsets the part still overlapping the controls', () => {
    mockWindowX = 50;
    render(<AddressHeader />);
    expect(margin()).toBe(30);
  });

  it.each([0, 9])(
    'keeps the Duo/fullscreen header unchanged with a %spt inset',
    (inset) => {
      mockWindowLeft = inset;
      render(<AddressHeader />);
      expect(margin()).toBe(0);
    },
  );

  it('ignores a stale measurement after the pane moves', () => {
    mockDeferMeasurement = true;
    const { rerender } = render(<AddressHeader />);
    const firstMeasurement = mockMeasurements[0];
    mockDimensions = { width: 1202, height: 800 };
    rerender(<AddressHeader />);
    act(() => mockMeasurements[1](600));
    act(() => firstMeasurement(0));
    expect(margin()).toBe(0);
  });
});
