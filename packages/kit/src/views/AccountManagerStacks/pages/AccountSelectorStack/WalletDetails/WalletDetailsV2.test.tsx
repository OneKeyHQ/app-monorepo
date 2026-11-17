/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { WalletDetailsV2 } from './WalletDetailsV2';

import type { IAccountSelectorRowRecordV2 } from './accountSelectorAccountRowsV2';
import type {
  NativeListProps,
  RowModel,
} from '@onekeyfe/react-native-native-list';

const mockConfirmAccountSelect = jest.fn(async (_params: unknown) => true);
const mockToastError = jest.fn((_params: unknown) => undefined);
const mockResetModal = jest.fn(() => undefined);
const mockReloadAccounts = jest.fn(async () => undefined);
let mockOnRowAction: NativeListProps['onRowAction'];
let mockSelectedAccount: IAccountSelectorSelectedAccount;
let mockRecord: IAccountSelectorRowRecordV2;
let mockListData: {
  sectionData: IAccountSelectorRowRecordV2['section'][];
  accountsCount: number;
  focusedWalletInfo: { wallet: { id: string } };
};
let mockRecords: IAccountSelectorRowRecordV2[];
const mockTheme = {};
const mockRows: RowModel[] = [];
const mockIntl = { formatMessage: ({ id }: { id: string }) => id };

jest.mock('react-intl', () => ({
  useIntl: () => mockIntl,
}));

jest.mock('@onekeyfe/react-native-native-list', () => ({
  NativeList: (props: NativeListProps) => {
    mockOnRowAction = props.onRowAction;
    return null;
  },
}));

jest.mock('@onekeyhq/components', () => {
  const Stack = ({
    children,
    onLayout,
  }: {
    children?: ReactNode;
    onLayout?: (event: { nativeEvent: { layout: { height: number } } }) => void;
  }) => (
    <div>
      {onLayout ? (
        <button
          type="button"
          onClick={() => onLayout({ nativeEvent: { layout: { height: 600 } } })}
        >
          layout
        </button>
      ) : null}
      {children}
    </div>
  );
  return {
    Alert: () => null,
    Button: () => null,
    SizableText: Stack,
    Stack,
    Toast: { error: (params: unknown) => mockToastError(params) },
    resetAccountManagerStacksModal: () => mockResetModal(),
    useSafeAreaInsets: () => ({ bottom: 0, top: 0 }),
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceAccountSelector: {} },
}));

jest.mock(
  '@onekeyhq/kit/src/components/AccountSelector/hooks/useCreateQrWallet',
  () => ({ useCreateQrWallet: () => ({ createQrWallet: jest.fn() }) }),
);

jest.mock('@onekeyhq/kit/src/hooks/useAllNetwork', () => ({
  useEnabledNetworksCompatibleWithWalletIdInAllNetworks: () => ({
    enabledNetworksCompatibleWithWalletId: [],
    networkInfoMap: {},
    isReady: true,
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({
    result: mockListData,
    run: mockReloadAccounts,
    setResult: jest.fn(),
  }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useSelectedAccount: () => ({ selectedAccount: mockSelectedAccount }),
  useAccountSelectorSceneInfo: () => ({
    sceneName: EAccountSelectorSceneName.discover,
  }),
  useAccountSelectorStorageReadyAtom: () => [true],
}));

jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions',
  () => ({
    useAccountSelectorActions: () => ({
      current: { confirmAccountSelect: mockConfirmAccountSelect },
    }),
  }),
);

jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/tokenList/cells/prewarmOwnerFrames',
  () => ({
    HOME_TOKEN_LIST_PREWARM_TAP_TIMEOUT_MS: 80,
    buildAccountSelectorRowPrewarmParams: jest.fn(),
    prewarmHomeTokenListOwner: jest.fn(),
    prewarmHomeTokenListOwnerWithin: jest.fn(),
  }),
);

jest.mock(
  '@onekeyhq/kit/src/views/Onboarding/pages/ConnectHardwareWallet/qrHiddenCreateGuideDialog',
  () => ({ __esModule: true, default: {} }),
);

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  accountSelectorAccountsListIsLoadingAtom: { set: jest.fn() },
  useSettingsPersistAtom: () => [{ currencyInfo: { id: 'usd' } }],
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    accountSelector: { perf: { renderAccountsList: jest.fn() } },
  },
}));

jest.mock('../../../components/WalletEdit/HiddenWalletRememberSwitch', () => ({
  HiddenWalletRememberSwitch: () => null,
}));
jest.mock('../../../router/useAccountSelectorRoute', () => ({
  useAccountSelectorRoute: () => ({ params: {} }),
}));
jest.mock('../accountSelectorNativeListV2', () => ({
  useAccountSelectorNativeListThemeV2: () => mockTheme,
}));
jest.mock('./accountSelectorAccountRowsV2', () => ({
  useAccountSelectorAccountRowsV2: () => ({
    rows: mockRows,
    records: mockRecords,
    areRowValuesReady: () => true,
  }),
  useAccountSelectorNativeSnapshotV2: ({ snapshot }: NativeListProps) =>
    snapshot,
}));
jest.mock('./AccountSelectorActionV2', () => ({
  AccountSelectorCreateAddressActionV2: () => null,
  AccountSelectorMenuActionV2: () => null,
}));
jest.mock('./accountSelectorAvatarPreload', () => ({
  preloadAccountSelectorAvatarImages: jest.fn(),
}));
jest.mock('./accountSelectorValueDisplayCacheV2', () => ({
  buildAccountSelectorValueDisplayScopeKeyV2: () => 'scope',
}));
jest.mock('./DeprecatedWalletBanner', () => ({
  DeprecatedWalletBanner: () => null,
}));
jest.mock('./EmptyView', () => ({
  EmptyNoAccountsView: () => null,
  EmptyView: () => null,
}));
jest.mock('./hooks/useAddAccount', () => ({
  useAddAccount: () => ({ handleAddAccount: jest.fn(), canAddAccount: false }),
}));
jest.mock('./useAccountSelectorValuesLoaderV2', () => ({
  useAccountSelectorValuesLoaderV2: () => ({ valuesLoaded: true }),
}));
jest.mock('./WalletDetailsHeader', () => ({ WalletDetailsHeader: () => null }));
jest.mock('./WalletDetailsHeader/AccountSearchBar', () => ({
  AccountSearchBar: () => null,
}));

describe.each(['hd-1', 'imported'] as const)(
  'WalletDetailsV2 account press (%s)',
  (walletId) => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockOnRowAction = undefined;
      mockConfirmAccountSelect.mockResolvedValue(true);
      mockSelectedAccount = {
        walletId,
        indexedAccountId: undefined,
        othersWalletAccountId: undefined,
        focusedWallet: walletId,
        networkId: 'evm--1',
        deriveType: 'default',
      };
      const item = {
        id: `${walletId}--0`,
        walletId,
        name: 'Account',
        address: '0x-test',
      } as unknown as IAccountSelectorRowRecordV2['item'];
      mockRecord = {
        key: item.id,
        item,
        account: walletId === 'imported' ? item : undefined,
        indexedAccount: walletId === 'hd-1' ? item : undefined,
        section: { walletId, data: [item] },
        index: 0,
        avatarNetworkId: 'evm--1',
        valuesNetworkId: 'evm--1',
        shouldShowCreateAddressButton: false,
        isCreatingAddress: false,
      } as IAccountSelectorRowRecordV2;
      mockListData = {
        sectionData: [mockRecord.section],
        accountsCount: 1,
        focusedWalletInfo: { wallet: { id: walletId } },
      };
      mockRecords = [mockRecord];
    });

    async function pressAccount() {
      render(<WalletDetailsV2 num={0} />);
      fireEvent.click(screen.getByText('layout'));
      expect(mockOnRowAction).toBeDefined();
      await act(async () => {
        mockOnRowAction?.({ actionKey: 'press', rowKey: mockRecord.key });
      });
      expect(mockConfirmAccountSelect).toHaveBeenCalledTimes(1);
      expect(mockConfirmAccountSelect).toHaveBeenCalledWith(
        expect.objectContaining(
          walletId === 'imported'
            ? { othersWalletAccount: mockRecord.account }
            : { indexedAccount: mockRecord.indexedAccount },
        ),
      );
    }

    it('catches persistence rejection, shows a toast, and keeps the modal open', async () => {
      mockConfirmAccountSelect.mockRejectedValueOnce(new Error('save failed'));
      await pressAccount();

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith({
          title: ETranslations.global_an_error_occurred,
          message: ETranslations.global_an_error_occurred_desc,
        });
      });
      expect(mockResetModal).not.toHaveBeenCalled();
    });

    it('keeps the modal open without an error toast on a stale selection', async () => {
      mockConfirmAccountSelect.mockResolvedValueOnce(false);
      await pressAccount();

      expect(mockToastError).not.toHaveBeenCalled();
      expect(mockResetModal).not.toHaveBeenCalled();
    });

    it('closes the modal after successful confirmation', async () => {
      await pressAccount();

      expect(mockToastError).not.toHaveBeenCalled();
      expect(mockResetModal).toHaveBeenCalledTimes(1);
    });
  },
);
