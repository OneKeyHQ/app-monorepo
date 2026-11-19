/** @jest-environment jsdom */

import type { PropsWithChildren } from 'react';

import { HeaderHeightContext } from '@react-navigation/elements';
import { renderHook } from '@testing-library/react';

import { useLiquidGlassHeaderTopInset } from './GlassHeaderContext';

let mockTop = 0;
let mockIsFoldableIPhone = false;

jest.mock('@react-navigation/elements', () => ({
  HeaderHeightContext: jest
    .requireActual<typeof import('react')>('react')
    .createContext<number | undefined>(undefined),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: mockTop }),
}));
jest.mock(
  '@onekeyhq/shared/src/modules/DualScreenInfo/isFoldableIPhone',
  () => ({
    isFoldableIPhone: () => mockIsFoldableIPhone,
  }),
);
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeIOS26Plus: true },
}));

function renderInset(headerHeight: number) {
  const wrapper = ({ children }: PropsWithChildren) => (
    <HeaderHeightContext.Provider value={headerHeight}>
      {children}
    </HeaderHeightContext.Provider>
  );
  return renderHook(useLiquidGlassHeaderTopInset, { wrapper }).result.current;
}

describe('useLiquidGlassHeaderTopInset', () => {
  it('keeps the fixed bar height on regular iPhones', () => {
    mockTop = 62;
    mockIsFoldableIPhone = false;
    expect(renderInset(116)).toBe(122);
  });

  it('uses the taller measured header on foldable iPhones', () => {
    mockTop = 0;
    mockIsFoldableIPhone = true;
    expect(renderInset(82)).toBe(98);
  });
});
