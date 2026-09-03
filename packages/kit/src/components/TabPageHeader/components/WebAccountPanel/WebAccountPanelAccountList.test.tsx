/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react';

import { WebAccountPanelAccountList } from './WebAccountPanelAccountList';

const capturedOnPressByTestID: Record<
  string,
  (() => void | Promise<void>) | undefined
> = {};

const mockConfirmAccountSelect = jest.fn(async (_params: unknown) => true);
const mockToastError = jest.fn((_params: unknown) => undefined);
const mockOnRequestClose = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: () => '' }),
}));

jest.mock('@onekeyhq/components', () => {
  const Passthrough = ({ children }: { children?: ReactNode }) =>
    children ?? null;
  return {
    Button: () => null,
    Icon: () => null,
    SizableText: () => null,
    Spinner: () => null,
    Stack: Passthrough,
    Toast: {
      error: (params: unknown) => {
        mockToastError(params);
      },
    },
    XStack: Passthrough,
    YStack: Passthrough,
  };
});

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    isOthersWallet: ({ walletId }: { walletId: string }) =>
      walletId.startsWith('imported'),
    shortenAddress: ({ address }: { address?: string }) => address ?? '',
  },
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/kit/src/components/AccountAvatar', () => ({
  AccountAvatar: () => null,
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({
    pushModal: jest.fn(),
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({
    result: {
      sectionData: [
        {
          walletId: 'hd-1',
          data: [{ id: 'hd-1--0', associateAccount: { address: '0xabc' } }],
        },
        {
          walletId: '$$others',
          data: [{ id: 'imported--1', address: '0xdef' }],
        },
      ],
    },
    isLoading: false,
  }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useSelectedAccount: () => ({
    selectedAccount: {
      focusedWallet: 'hd-1',
      networkId: 'evm--1',
      deriveType: 'default',
      indexedAccountId: 'hd-1--0',
      othersWalletAccountId: undefined,
    },
  }),
}));

jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actionsLazy',
  () => ({
    useAccountSelectorLazyAction:
      () => async (name: string, params: unknown) => {
        if (name === 'confirmAccountSelect') {
          return mockConfirmAccountSelect(params);
        }
        return undefined;
      },
  }),
);

jest.mock('./atoms/WebAccountPanelListItem', () => ({
  WebAccountPanelListItem: ({
    onPress,
    testID,
  }: {
    onPress?: () => void | Promise<void>;
    testID?: string;
  }) => {
    if (testID) {
      capturedOnPressByTestID[testID] = onPress;
    }
    return null;
  },
}));

async function pressRow(testID: string) {
  render(<WebAccountPanelAccountList onRequestClose={mockOnRequestClose} />);
  const onPress = capturedOnPressByTestID[testID];
  expect(onPress).toBeDefined();
  await act(async () => {
    await onPress?.();
  });
}

describe('WebAccountPanelAccountList account select', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(capturedOnPressByTestID).forEach((key) => {
      delete capturedOnPressByTestID[key];
    });
    mockConfirmAccountSelect.mockImplementation(async () => true);
  });

  it('toasts on a rejected confirmAccountSelect and keeps the panel open', async () => {
    mockConfirmAccountSelect.mockImplementation(() =>
      Promise.reject(new Error('save to storage failed')),
    );

    await pressRow('web-account-panel-account-hd-1--0');

    expect(mockToastError).toHaveBeenCalledTimes(1);
    // The panel must stay open so the user can retry the row.
    expect(mockOnRequestClose).not.toHaveBeenCalled();
  });

  it('silently keeps the panel open when confirmAccountSelect returns false', async () => {
    mockConfirmAccountSelect.mockResolvedValue(false);

    await pressRow('web-account-panel-account-hd-1--0');

    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockOnRequestClose).not.toHaveBeenCalled();
  });

  it('closes the panel when an indexed-account selection is persisted', async () => {
    await pressRow('web-account-panel-account-hd-1--0');

    expect(mockConfirmAccountSelect).toHaveBeenCalledTimes(1);
    expect(mockConfirmAccountSelect.mock.calls[0][0]).toMatchObject({
      entry: 'webAccountPanel:indexedAccount',
      throwOnError: true,
    });
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockOnRequestClose).toHaveBeenCalledTimes(1);
  });

  it('closes the panel when an others-wallet selection is persisted', async () => {
    await pressRow('web-account-panel-account-imported--1');

    expect(mockConfirmAccountSelect).toHaveBeenCalledTimes(1);
    expect(mockConfirmAccountSelect.mock.calls[0][0]).toMatchObject({
      entry: 'webAccountPanel:othersWallet',
      autoChangeToAccountMatchedNetworkId: 'evm--1',
      throwOnError: true,
    });
    expect(mockOnRequestClose).toHaveBeenCalledTimes(1);
  });
});
