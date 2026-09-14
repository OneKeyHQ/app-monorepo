/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render, waitFor } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import SwapHeaderContainer from './SwapHeaderContainer';

const mockSwapTypeSwitchAction = jest.fn<
  Promise<ISwapToken | undefined>,
  [
    ESwapTabSwitchType,
    string | undefined,
    (
      | {
          carryTargetToken?: boolean;
          proSupportedNetworkIds?: ReadonlySet<string>;
          stableTokenKeys?: ReadonlySet<string>;
        }
      | undefined
    ),
  ]
>();
const mockUpdateSelectedAccountNetwork = jest.fn<Promise<void>, [unknown]>();
const mockSetParams = jest.fn();
const mockSwapProTokenCarryOptions = {
  proSupportedNetworkIds: new Set(['evm--1']),
  stableTokenKeys: new Set<string>(),
};
const mockFromToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '',
  symbol: 'BNB',
  decimals: 18,
  isNative: true,
};
const mockProToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xuni',
  symbol: 'UNI',
  decimals: 18,
  isNative: false,
};
let mockAccountNetworkId = mockProToken.networkId;

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));
jest.mock('@onekeyhq/components', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const Container = ({
    children,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
  }) =>
    createElement(
      onPress ? 'button' : 'div',
      {
        'data-testid': testID,
        onClick: onPress,
      },
      children,
    );
  return {
    SegmentControl: Container,
    SizableText: Container,
    Stack: Container,
    XStack: Container,
    useMedia: () => ({ gtLg: false }),
  };
});
jest.mock('@onekeyhq/kit/src/components/ScrollableFilterBar', () => ({
  ScrollableFilterBar: ({ children }: { children?: ReactNode }) => children,
  useScrollableFilterBar: () => ({ handleItemLayout: jest.fn() }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ setParams: mockSetParams }),
}));
jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions',
  () => ({
    useAccountSelectorActions: () => ({
      current: {
        updateSelectedAccountNetwork: mockUpdateSelectedAccountNetwork,
      },
    }),
  }),
);
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/swap', () => ({
  useSwapActions: () => ({
    current: { swapTypeSwitchAction: mockSwapTypeSwitchAction },
  }),
  useSwapProSelectTokenAtom: () => [mockProToken],
  useSwapSelectFromTokenAtom: () => [mockFromToken],
  useSwapTypeSwitchAtom: () => [ESwapTabSwitchType.LIMIT],
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/swap', () => ({
  useSwapProJumpTokenAtom: () => [{ token: undefined }],
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    swap: {
      swapPro: { enterSwapPro: jest.fn() },
      tradeCategorySwitch: { tradeCategorySwitch: jest.fn() },
    },
  },
}));
jest.mock('../../hooks/useSwapAccount', () => ({
  useSwapAddressInfo: () => ({ networkId: mockAccountNetworkId }),
}));
jest.mock('../../hooks/useSwapProTokenCarry', () => ({
  useSwapProTokenCarryOptions: () => mockSwapProTokenCarryOptions,
}));
jest.mock('./SwapHeaderRightActionContainer', () => () => null);

describe('SwapHeaderContainer', () => {
  beforeEach(() => {
    platformEnv.isNative = true;
    jest.clearAllMocks();
    mockAccountNetworkId = mockProToken.networkId;
    mockSwapTypeSwitchAction.mockResolvedValue(mockFromToken);
    mockUpdateSelectedAccountNetwork.mockResolvedValue(undefined);
  });

  afterEach(() => {
    platformEnv.isNative = false;
  });

  it('leaves the Pro owner before synchronizing the restored Swap network', async () => {
    let resolveTypeSwitch: ((token?: ISwapToken) => void) | undefined;
    mockSwapTypeSwitchAction.mockImplementation(
      () =>
        new Promise<ISwapToken | undefined>((resolve) => {
          resolveTypeSwitch = resolve;
        }),
    );
    const { getByTestId } = render(
      <SwapHeaderContainer showSwapPro hideRightActions />,
    );

    fireEvent.click(getByTestId(`swap-type-tab-${ESwapTabSwitchType.SWAP}`));

    expect(mockSwapTypeSwitchAction).toHaveBeenCalledWith(
      ESwapTabSwitchType.SWAP,
      mockFromToken.networkId,
      {
        carryTargetToken: true,
        ...mockSwapProTokenCarryOptions,
      },
    );
    expect(mockUpdateSelectedAccountNetwork).not.toHaveBeenCalled();

    await act(async () => {
      resolveTypeSwitch?.(mockFromToken);
    });

    await waitFor(() => {
      expect(mockUpdateSelectedAccountNetwork).toHaveBeenCalledWith({
        num: 0,
        networkId: mockFromToken.networkId,
      });
    });
  });

  it('syncs the account to the settled Swap fromToken after a Pro target remap', async () => {
    mockAccountNetworkId = mockFromToken.networkId;
    mockSwapTypeSwitchAction.mockResolvedValue(mockProToken);
    const { getByTestId } = render(
      <SwapHeaderContainer showSwapPro hideRightActions />,
    );

    fireEvent.click(getByTestId(`swap-type-tab-${ESwapTabSwitchType.SWAP}`));

    await waitFor(() => {
      expect(mockUpdateSelectedAccountNetwork).toHaveBeenCalledWith({
        num: 0,
        networkId: mockProToken.networkId,
      });
    });
    expect(mockUpdateSelectedAccountNetwork).not.toHaveBeenCalledWith({
      num: 0,
      networkId: mockFromToken.networkId,
    });
  });
});
