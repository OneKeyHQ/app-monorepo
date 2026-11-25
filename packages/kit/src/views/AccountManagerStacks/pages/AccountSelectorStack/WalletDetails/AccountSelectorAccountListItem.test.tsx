/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorAccountListItem } from './AccountSelectorAccountListItem';

let capturedOnPress: (() => Promise<void>) | undefined;
// One entry per ListItem render; used to compare render-prop identity across
// re-renders.
let capturedRenderItemTexts: unknown[] = [];
let mockSceneName = EAccountSelectorSceneName.home;

const mockConfirmAccountSelect = jest.fn(async (_params: unknown) => true);
const mockPrewarmHomeTokenListOwnerWithin = jest.fn(async () => undefined);
const mockToastError = jest.fn((_params: unknown) => undefined);
const mockResetAccountManagerStacksModal = jest.fn();
// What the create-address button reports when it is pressed: the created
// account on success, nothing when the creation failed or was cancelled.
let mockCreateAddressResult: { accounts: unknown[] } | undefined;
// The account the create-address button was last asked to create.
let capturedCreateAccount: { deriveType?: string } | undefined;

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: () => '' }),
}));

jest.mock('@onekeyhq/components', () => {
  const Passthrough = ({ children }: { children?: ReactNode }) =>
    children ?? null;
  return {
    Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
    IconButton: () => null,
    SizableText: () => null,
    Spinner: () => null,
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
    AccountSelectorCreateAddressButton: ({
      account,
      onCreateDone,
    }: {
      account?: { deriveType?: string };
      onCreateDone?: (result: typeof mockCreateAddressResult) => void;
    }) => {
      capturedCreateAccount = account;
      return (
        <button
          type="button"
          data-testid="create-address"
          onClick={() => onCreateDone?.(mockCreateAddressResult)}
        >
          create
        </button>
      );
    },
  }),
);

jest.mock('@onekeyhq/kit/src/components/ListItem', () => {
  const ListItemMock = ({
    onPress,
    renderItemText,
    children,
  }: {
    onPress?: () => Promise<void>;
    renderItemText?: unknown;
    children?: ReactNode;
  }) => {
    capturedOnPress = onPress;
    capturedRenderItemTexts.push(renderItemText);
    return children ?? null;
  };
  ListItemMock.Text = () => null;
  return { ListItem: ListItemMock };
});

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useAccountSelectorSceneInfo: () => ({ sceneName: mockSceneName }),
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

jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/tokenList/cells/prewarmOwnerFrames',
  () => ({
    HOME_TOKEN_LIST_PREWARM_TAP_TIMEOUT_MS: 80,
    prewarmHomeTokenListOwnerWithin: () =>
      mockPrewarmHomeTokenListOwnerWithin(),
  }),
);

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useAccountSelectorDeFiMapAtom: () => [{}],
  useAccountSelectorValuesMapAtom: () => [{}],
  useIndexedAccountAddressCreationStateAtom: () => [undefined],
  useSettingsPersistAtom: () => [{ currencyInfo: { id: 'usd' } }],
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

async function pressItem(overrides: Partial<IProps> = {}) {
  render(<AccountSelectorAccountListItem {...buildProps(overrides)} />);
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
    mockSceneName = EAccountSelectorSceneName.home;
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

    expect(mockPrewarmHomeTokenListOwnerWithin).toHaveBeenCalledTimes(1);
    expect(mockConfirmAccountSelect).toHaveBeenCalledTimes(1);
    expect(
      mockPrewarmHomeTokenListOwnerWithin.mock.invocationCallOrder[0],
    ).toBeLessThan(mockConfirmAccountSelect.mock.invocationCallOrder[0]);
    expect(mockConfirmAccountSelect.mock.calls[0][0]).toMatchObject({
      entry: 'accountList:indexedAccount',
      reason: 'userSelectAccount',
    });
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockResetAccountManagerStacksModal).toHaveBeenCalledTimes(1);
  });

  it('closes only the embedded selector after persisting a reward account', async () => {
    mockSceneName = EAccountSelectorSceneName.rewardCenter;
    const onAccountSelected = jest.fn();

    await pressItem({ onAccountSelected, compact: true });

    expect(mockConfirmAccountSelect).toHaveBeenCalledTimes(1);
    expect(onAccountSelected).toHaveBeenCalledTimes(1);
    expect(mockConfirmAccountSelect.mock.invocationCallOrder[0]).toBeLessThan(
      onAccountSelected.mock.invocationCallOrder[0],
    );
    expect(mockResetAccountManagerStacksModal).not.toHaveBeenCalled();
    expect(mockPrewarmHomeTokenListOwnerWithin).not.toHaveBeenCalled();
  });

  it('keeps the embedded selector open when selection is cancelled', async () => {
    const onAccountSelected = jest.fn();
    mockConfirmAccountSelect.mockResolvedValueOnce(false);

    await pressItem({ onAccountSelected });

    expect(onAccountSelected).not.toHaveBeenCalled();
    expect(mockResetAccountManagerStacksModal).not.toHaveBeenCalled();
  });

  it('keeps the embedded selector open when persisting selection fails', async () => {
    const onAccountSelected = jest.fn();
    mockConfirmAccountSelect.mockRejectedValueOnce(new Error('save failed'));

    await pressItem({ onAccountSelected });

    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(onAccountSelected).not.toHaveBeenCalled();
    expect(mockResetAccountManagerStacksModal).not.toHaveBeenCalled();
  });

  it.each([
    EAccountSelectorSceneName.swap,
    EAccountSelectorSceneName.addressInput,
    EAccountSelectorSceneName.discover,
  ])(
    'skips home prewarm when selecting an indexed account in %s',
    async (sceneName) => {
      mockSceneName = sceneName;

      await pressItem();

      expect(mockPrewarmHomeTokenListOwnerWithin).not.toHaveBeenCalled();
      expect(mockConfirmAccountSelect).toHaveBeenCalledTimes(1);
      expect(mockResetAccountManagerStacksModal).toHaveBeenCalledTimes(1);
    },
  );

  it.each([EAccountSelectorSceneName.home, EAccountSelectorSceneName.swap])(
    'only prewarms home for an others-wallet selection in %s',
    async (sceneName) => {
      mockSceneName = sceneName;

      await pressItem({ isOthersUniversal: true });

      expect(mockPrewarmHomeTokenListOwnerWithin).toHaveBeenCalledTimes(
        sceneName === EAccountSelectorSceneName.home ? 1 : 0,
      );
      expect(mockConfirmAccountSelect).toHaveBeenCalledWith(
        expect.objectContaining({ entry: 'accountList:othersWallet' }),
      );
      expect(mockResetAccountManagerStacksModal).toHaveBeenCalledTimes(1);
    },
  );

  it('keeps the selector modal open without a toast when the selection is cancelled', async () => {
    // confirmAccountSelect resolving false means the user backed out (e.g. a
    // dialog was dismissed); that is not an error, just no close.
    mockConfirmAccountSelect.mockImplementation(async () => false);

    await pressItem();

    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockResetAccountManagerStacksModal).not.toHaveBeenCalled();
  });
});

// The compact list of the reward account popover: every row ends in one
// action slot, a check for the selected account or "+" for an account that
// has no address on the linked network yet.
describe('AccountSelectorAccountListItem compact action', () => {
  const TRON = 'tron--0x2b6653dc';
  const noAddressItem = {
    id: 'hd-1--2',
    name: 'Account #3',
  } as unknown as IProps['item'];
  const selected = (indexedAccountId: string) =>
    ({
      indexedAccountId,
      othersWalletAccountId: undefined,
      networkId: TRON,
      deriveType: 'default',
    }) as unknown as IProps['selectedAccount'];
  const compactProps = (overrides: Partial<IProps> = {}) =>
    buildProps({
      compact: true,
      linkNetwork: true,
      linkedNetworkId: TRON,
      ...overrides,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateAddressResult = undefined;
    capturedCreateAccount = undefined;
  });

  // The selection can sit on another network (a Bitcoin BIP84 account at
  // home): its derivation type does not exist on the linked one.
  it('creates the address with the derivation type of the linked network', () => {
    render(
      <AccountSelectorAccountListItem
        {...compactProps({
          item: noAddressItem,
          selectedAccount: {
            ...selected('hd-1--2'),
            deriveType: 'BIP84',
          } as IProps['selectedAccount'],
          createAddressDeriveType: 'default',
        })}
      />,
    );
    expect(capturedCreateAccount?.deriveType).toBe('default');
  });

  it('falls back to the selected derivation type when no network is linked to one', () => {
    render(
      <AccountSelectorAccountListItem
        {...compactProps({
          item: noAddressItem,
          selectedAccount: {
            ...selected('hd-1--2'),
            deriveType: 'BIP84',
          } as IProps['selectedAccount'],
        })}
      />,
    );
    expect(capturedCreateAccount?.deriveType).toBe('BIP84');
  });

  it('marks the selected account with a check', () => {
    render(
      <AccountSelectorAccountListItem
        {...compactProps({ selectedAccount: selected('hd-1--0') })}
      />,
    );
    expect(screen.getByTestId('icon-CheckRadioSolid')).toBeTruthy();
    expect(screen.queryByTestId('create-address')).toBeNull();
  });

  // The row of an account without an address cannot be pressed, so the check
  // would leave the selected one with no way to create its address here.
  it('offers address creation for the selected account when it has no address', () => {
    render(
      <AccountSelectorAccountListItem
        {...compactProps({
          item: noAddressItem,
          selectedAccount: selected('hd-1--2'),
        })}
      />,
    );
    expect(screen.getByTestId('create-address')).toBeTruthy();
    expect(screen.queryByTestId('icon-CheckRadioSolid')).toBeNull();
  });

  it('closes the embedded selector once the address is created and selected', () => {
    const onAccountSelected = jest.fn();
    mockCreateAddressResult = { accounts: [{ id: 'hd-1--account-3' }] };
    render(
      <AccountSelectorAccountListItem
        {...compactProps({ item: noAddressItem, onAccountSelected })}
      />,
    );
    fireEvent.click(screen.getByTestId('create-address'));
    expect(onAccountSelected).toHaveBeenCalledTimes(1);
    expect(mockResetAccountManagerStacksModal).not.toHaveBeenCalled();
  });

  it('keeps the embedded selector open when the address is not created', () => {
    const onAccountSelected = jest.fn();
    render(
      <AccountSelectorAccountListItem
        {...compactProps({ item: noAddressItem, onAccountSelected })}
      />,
    );
    fireEvent.click(screen.getByTestId('create-address'));
    expect(onAccountSelected).not.toHaveBeenCalled();
  });

  it('leaves the full selector open after creating an address', () => {
    mockCreateAddressResult = { accounts: [{ id: 'hd-1--account-3' }] };
    render(
      <AccountSelectorAccountListItem
        {...buildProps({
          linkNetwork: true,
          linkedNetworkId: TRON,
          item: noAddressItem,
        })}
      />,
    );
    fireEvent.click(screen.getByTestId('create-address'));
    expect(mockResetAccountManagerStacksModal).not.toHaveBeenCalled();
  });
});
