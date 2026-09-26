/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react';

import { AccountSelectorAccountListItem } from './AccountSelectorAccountListItem';

let capturedOnPress: (() => Promise<void>) | undefined;
// One entry per ListItem render; used to compare render-prop identity across
// re-renders.
let capturedRenderItemTexts: unknown[] = [];

const mockConfirmAccountSelect = jest.fn(async (_params: unknown) => true);
const mockToastError = jest.fn((_params: unknown) => undefined);
const mockResetAccountManagerStacksModal = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: () => '' }),
}));

jest.mock('@onekeyhq/components', () => {
  const Passthrough = ({ children }: { children?: ReactNode }) =>
    children ?? null;
  return {
    IconButton: () => null,
    SizableText: () => null,
    Stack: Passthrough,
    Toast: {
      error: (params: unknown) => {
        mockToastError(params);
      },
    },
    XStack: Passthrough,
    resetAccountManagerStacksModal: () => {
      mockResetAccountManagerStacksModal();
    },
  };
});

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    shortenAddress: ({ address }: { address?: string }) => address ?? '',
  },
}));

jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {
    isAllNetwork: () => false,
  },
}));

jest.mock('@onekeyhq/kit/src/components/AccountAvatar', () => {
  const AccountAvatarMock = () => null;
  AccountAvatarMock.Loading = () => null;
  return { AccountAvatar: AccountAvatarMock };
});

jest.mock(
  '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorCreateAddressButton',
  () => ({
    AccountSelectorCreateAddressButton: () => null,
  }),
);

jest.mock('@onekeyhq/kit/src/components/ListItem', () => {
  const ListItemMock = ({
    onPress,
    renderItemText,
  }: {
    onPress?: () => Promise<void>;
    renderItemText?: unknown;
  }) => {
    capturedOnPress = onPress;
    capturedRenderItemTexts.push(renderItemText);
    return null;
  };
  ListItemMock.Text = () => null;
  return { ListItem: ListItemMock };
});

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: { network: { id: 'evm--1' } },
  }),
}));

jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions',
  () => ({
    useAccountSelectorActions: () => ({
      current: {
        confirmAccountSelect: async (params: unknown) =>
          mockConfirmAccountSelect(params),
      },
    }),
  }),
);

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useAccountSelectorDeFiMapAtom: () => [{}],
  useAccountSelectorValuesMapAtom: () => [{}],
  useIndexedAccountAddressCreationStateAtom: () => [undefined],
}));

jest.mock('../../../components/AccountEdit', () => ({
  AccountEditButton: () => null,
}));

jest.mock('../../../hooks/useAccountSelectorAvatarNetwork', () => ({
  useAccountSelectorAvatarNetwork: () => ({ avatarNetworkId: 'evm--1' }),
}));

jest.mock('./AccountAddress', () => ({
  AccountAddress: () => null,
}));

jest.mock('./AccountValue', () => ({
  AccountValueWithSpotlight: () => null,
}));

const indexedAccountItem = {
  id: 'hd-1--0',
  name: 'Account #1',
  associateAccount: {
    id: 'hd-1--account-1',
    address: '0xabc',
    addressDetail: { isValid: true, normalizedAddress: '0xabc' },
  },
} as unknown as Parameters<typeof AccountSelectorAccountListItem>[0]['item'];

type IProps = Parameters<typeof AccountSelectorAccountListItem>[0];

function buildProps(overrides: Partial<IProps> = {}): IProps {
  return {
    num: 0,
    linkedNetworkId: undefined,
    item: indexedAccountItem,
    section: { walletId: 'hd-1', data: [indexedAccountItem] },
    index: 0,
    isOthersUniversal: false,
    selectedAccount: {
      indexedAccountId: 'hd-1--1',
      othersWalletAccountId: undefined,
      networkId: 'evm--1',
      deriveType: 'default',
    },
    linkNetwork: undefined,
    allowSelectEmptyAccount: false,
    editable: false,
    accountsCount: 1,
    focusedWalletInfo: {
      wallet: { id: 'hd-1' },
      device: undefined,
    },
    mergeDeriveAssetsEnabled: false,
    enabledNetworksCompatibleWithWalletId: [],
    networkInfoMap: {},
    ...overrides,
  } as unknown as IProps;
}

async function pressItem() {
  render(<AccountSelectorAccountListItem {...buildProps()} />);
  expect(capturedOnPress).toBeDefined();
  await act(async () => {
    await capturedOnPress?.();
  });
}

describe('AccountSelectorAccountListItem account select', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedOnPress = undefined;
    capturedRenderItemTexts = [];
    mockConfirmAccountSelect.mockImplementation(async () => true);
  });

  it('keeps the renderItemText identity stable across unrelated re-renders', () => {
    // ListItem renders renderItemText as a component type
    // (`<Render {...props} />`), so a new function identity per render means
    // React unmounts and remounts the whole text subtree. This guards the
    // useCallback memoization: reverting it to an inline arrow would hand
    // ListItem a fresh function on the second render and fail this test.
    const props = buildProps();
    const view = render(<AccountSelectorAccountListItem {...props} />);
    view.rerender(<AccountSelectorAccountListItem {...props} />);

    expect(capturedRenderItemTexts.length).toBeGreaterThanOrEqual(2);
    expect(typeof capturedRenderItemTexts[0]).toBe('function');
    expect(capturedRenderItemTexts[1]).toBe(capturedRenderItemTexts[0]);
  });

  it('toasts on a rejected confirmAccountSelect and keeps the selector modal open', async () => {
    mockConfirmAccountSelect.mockImplementation(() =>
      Promise.reject(new Error('save to storage failed')),
    );

    await pressItem();

    expect(mockToastError).toHaveBeenCalledTimes(1);
    // The selection never reached storage, so the modal must stay open.
    expect(mockResetAccountManagerStacksModal).not.toHaveBeenCalled();
  });

  it('closes the selector modal when the selection is persisted', async () => {
    await pressItem();

    expect(mockConfirmAccountSelect).toHaveBeenCalledTimes(1);
    expect(mockConfirmAccountSelect.mock.calls[0][0]).toMatchObject({
      entry: 'accountList:indexedAccount',
      reason: 'userSelectAccount',
    });
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockResetAccountManagerStacksModal).toHaveBeenCalledTimes(1);
  });

  it('keeps the selector modal open without a toast when the selection is cancelled', async () => {
    // confirmAccountSelect resolving false means the user backed out (e.g. a
    // dialog was dismissed); that is not an error, just no close.
    mockConfirmAccountSelect.mockImplementation(async () => false);

    await pressItem();

    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockResetAccountManagerStacksModal).not.toHaveBeenCalled();
  });
});
