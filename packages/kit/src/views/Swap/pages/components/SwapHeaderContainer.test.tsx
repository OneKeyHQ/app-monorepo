/** @jest-environment jsdom */

import { act, render } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import SwapHeaderContainer from './SwapHeaderContainer';

let mockSwapTypeSwitch = ESwapTabSwitchType.SWAP;
const mockSwapTypeSwitchAction = jest.fn();
const mockNavigationSetParams = jest.fn();
let mockSegmentControlValue: ESwapTabSwitchType | undefined;

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => ({
  SegmentControl: ({ value }: { value: ESwapTabSwitchType }) => {
    mockSegmentControlValue = value;
    return null;
  },
  SizableText: ({ children }: { children?: React.ReactNode }) => children,
  Stack: ({ children }: { children?: React.ReactNode }) => children,
  XStack: ({ children }: { children?: React.ReactNode }) => children,
  useMedia: () => ({ gtLg: true }),
}));

jest.mock('@onekeyhq/kit/src/components/ScrollableFilterBar', () => ({
  ScrollableFilterBar: ({ children }: { children?: React.ReactNode }) =>
    children,
  useScrollableFilterBar: () => ({ handleItemLayout: jest.fn() }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => () => ({
  setParams: mockNavigationSetParams,
}));

jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions',
  () => ({
    useAccountSelectorActions: () => ({
      current: { updateSelectedAccountNetwork: jest.fn() },
    }),
  }),
);

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/swap', () => ({
  useSwapActions: () => ({
    current: { swapTypeSwitchAction: mockSwapTypeSwitchAction },
  }),
  useSwapSelectFromTokenAtom: () => [undefined],
  useSwapTypeSwitchAtom: () => [mockSwapTypeSwitch],
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/swap', () => ({
  useSwapProJumpTokenAtom: () => [{}],
}));

jest.mock('../../hooks/useSwapAccount', () => ({
  useSwapAddressInfo: () => ({ networkId: 'evm--56' }),
}));

jest.mock('./SwapHeaderRightActionContainer', () => () => null);

describe('SwapHeaderContainer default type initialization', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSwapTypeSwitch = ESwapTabSwitchType.SWAP;
    mockSwapTypeSwitchAction.mockReset();
    mockNavigationSetParams.mockReset();
    mockSegmentControlValue = undefined;
    platformEnv.isNative = false;
    platformEnv.isExtension = false;
    platformEnv.isExtensionUiSidePanel = false;
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('does not run the delayed action when the initial Stock type already landed', () => {
    mockSwapTypeSwitch = ESwapTabSwitchType.STOCK;

    render(<SwapHeaderContainer defaultSwapType={ESwapTabSwitchType.STOCK} />);
    act(() => jest.runAllTimers());

    expect(mockSwapTypeSwitchAction).not.toHaveBeenCalled();
  });

  it.each([ESwapTabSwitchType.SWAP, ESwapTabSwitchType.LIMIT])(
    'does not repeat an exact %s initialization',
    (swapType) => {
      mockSwapTypeSwitch = swapType;

      render(<SwapHeaderContainer defaultSwapType={swapType} />);
      act(() => jest.runAllTimers());

      expect(mockSwapTypeSwitchAction).not.toHaveBeenCalled();
    },
  );

  it('keeps exact BRIDGE to SWAP initialization semantics', () => {
    mockSwapTypeSwitch = ESwapTabSwitchType.BRIDGE;

    render(<SwapHeaderContainer defaultSwapType={ESwapTabSwitchType.SWAP} />);
    act(() => jest.runAllTimers());

    expect(mockSwapTypeSwitchAction).toHaveBeenCalledTimes(1);
    expect(mockSwapTypeSwitchAction).toHaveBeenCalledWith(
      ESwapTabSwitchType.SWAP,
      undefined,
    );
  });

  it('renders the internal BRIDGE protocol as the selected Swap & Bridge tab', () => {
    mockSwapTypeSwitch = ESwapTabSwitchType.BRIDGE;

    render(<SwapHeaderContainer />);

    expect(mockSegmentControlValue).toBe(ESwapTabSwitchType.SWAP);
    expect(mockSwapTypeSwitchAction).not.toHaveBeenCalled();
  });

  it('still initializes Stock when the current type is ordinary Swap', () => {
    render(<SwapHeaderContainer defaultSwapType={ESwapTabSwitchType.STOCK} />);
    act(() => jest.runAllTimers());

    expect(mockSwapTypeSwitchAction).toHaveBeenCalledTimes(1);
    expect(mockSwapTypeSwitchAction).toHaveBeenCalledWith(
      ESwapTabSwitchType.STOCK,
      undefined,
    );
  });

  it('keeps ordinary Swap to Limit initialization semantics', () => {
    render(<SwapHeaderContainer defaultSwapType={ESwapTabSwitchType.LIMIT} />);
    act(() => jest.runAllTimers());

    expect(mockSwapTypeSwitchAction).toHaveBeenCalledTimes(1);
    expect(mockSwapTypeSwitchAction).toHaveBeenCalledWith(
      ESwapTabSwitchType.LIMIT,
      undefined,
    );
  });

  it('keeps Limit to ordinary Swap initialization semantics', () => {
    mockSwapTypeSwitch = ESwapTabSwitchType.LIMIT;

    render(<SwapHeaderContainer defaultSwapType={ESwapTabSwitchType.SWAP} />);
    act(() => jest.runAllTimers());

    expect(mockSwapTypeSwitchAction).toHaveBeenCalledTimes(1);
    expect(mockSwapTypeSwitchAction).toHaveBeenCalledWith(
      ESwapTabSwitchType.SWAP,
      undefined,
    );
  });
});
