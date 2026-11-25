import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IButtonProps } from '@onekeyhq/components';
import {
  Icon,
  IconButton,
  SizableText,
  Spinner,
  Stack,
  Toast,
  XStack,
  resetAccountManagerStacksModal,
} from '@onekeyhq/components';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import { AccountSelectorCreateAddressButton } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorCreateAddressButton';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { IListItemTextProps } from '@onekeyhq/kit/src/components/ListItem';
import {
  useAccountSelectorSceneInfo,
  useActiveAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions';
import {
  HOME_TOKEN_LIST_PREWARM_TAP_TIMEOUT_MS,
  prewarmHomeTokenListOwnerWithin,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList/cells/prewarmOwnerFrames';
import type {
  IDBAccount,
  IDBDevice,
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type {
  IAccountSelectorAccountsListSectionData,
  IAccountSelectorSelectedAccount,
} from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import {
  useAccountSelectorDeFiMapAtom,
  useAccountSelectorValuesMapAtom,
  useIndexedAccountAddressCreationStateAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IAccountDeriveTypes,
  INetworkDeriveInfo,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { AccountEditButton } from '../../../components/AccountEdit';
import { useAccountSelectorAvatarNetwork } from '../../../hooks/useAccountSelectorAvatarNetwork';
import { AccountManagerTestIDs } from '../../../testIDs';

import { AccountAddress } from './AccountAddress';
import { AccountValueWithSpotlight } from './AccountValue';

function PlusButton({ onPress, loading, size = 'medium' }: IButtonProps) {
  return (
    <IconButton
      testID="account-manager-plus-button-icon-btn"
      borderWidth={0}
      borderRadius="$2"
      variant="tertiary"
      size={size}
      {...(size === 'small' ? { m: '$0' as const } : {})}
      loading={loading}
      onPress={onPress}
      icon="PlusSmallOutline"
    />
  );
}

function CompactPlusButton(props: IButtonProps) {
  return <PlusButton {...props} size="small" />;
}

export function AccountSelectorAccountListItem({
  num,
  linkedNetworkId,
  item,
  section,
  index,
  isOthersUniversal,
  selectedAccount,
  linkNetwork,
  allowSelectEmptyAccount,
  editable,
  accountsCount,
  focusedWalletInfo,
  mergeDeriveAssetsEnabled,
  hideAddress,
  enabledNetworksCompatibleWithWalletId,
  networkInfoMap,
  onAccountSelected,
  compact = false,
  createAddressDeriveType,
}: {
  num: number;
  linkedNetworkId: string | undefined;
  item: IDBIndexedAccount | IDBAccount;
  section: IAccountSelectorAccountsListSectionData;
  index: number;
  isOthersUniversal: boolean;
  selectedAccount: IAccountSelectorSelectedAccount;
  linkNetwork: boolean | undefined;
  allowSelectEmptyAccount: boolean | undefined;
  editable: boolean;
  accountsCount: number;
  focusedWalletInfo:
    | {
        wallet: IDBWallet;
        device: IDBDevice | undefined;
      }
    | undefined;
  mergeDeriveAssetsEnabled: boolean | undefined;
  hideAddress?: boolean;
  enabledNetworksCompatibleWithWalletId: IServerNetwork[];
  networkInfoMap: Record<string, INetworkDeriveInfo>;
  onAccountSelected?: () => void;
  compact?: boolean;
  // The derivation type the list looks the row addresses up with. The
  // selection can sit on another network, whose type does not exist on the
  // linked one.
  createAddressDeriveType?: IAccountDeriveTypes;
}) {
  const intl = useIntl();
  const actions = useAccountSelectorActions();
  const { sceneName } = useAccountSelectorSceneInfo();
  const canPrewarmHomeTokenList = sceneName === EAccountSelectorSceneName.home;
  const {
    activeAccount: { network },
  } = useActiveAccount({
    num,
  });

  const [addressCreationState] = useIndexedAccountAddressCreationStateAtom();
  const [valuesMapAll] = useAccountSelectorValuesMapAtom();
  const [{ currencyInfo }] = useSettingsPersistAtom();
  const [deFiMapAll] = useAccountSelectorDeFiMapAtom();
  const valuesMap = useMemo(() => valuesMapAll[num], [valuesMapAll, num]);
  const deFiMap = useMemo(() => deFiMapAll[num], [deFiMapAll, num]);

  const account = useMemo(
    () => (isOthersUniversal ? (item as IDBAccount) : undefined),
    [isOthersUniversal, item],
  );
  const indexedAccount = useMemo(
    () => (isOthersUniversal ? undefined : (item as IDBIndexedAccount)),
    [isOthersUniversal, item],
  );

  const isCreatingAddress = useMemo(
    () =>
      Boolean(
        addressCreationState?.indexedAccountId === indexedAccount?.id &&
        addressCreationState?.walletId === focusedWalletInfo?.wallet?.id,
      ),
    [
      addressCreationState?.indexedAccountId,
      addressCreationState?.walletId,
      focusedWalletInfo?.wallet?.id,
      indexedAccount?.id,
    ],
  );

  const buildSubTitleInfo = useCallback((): {
    linkedNetworkId: string | undefined;
    address: string;
    isEmptyAddress: boolean;
    hideAddress?: boolean;
  } => {
    let address: string | undefined;
    let allowEmptyAddress = false;
    if (isOthersUniversal) {
      address = account?.address;
    } else {
      const associateAccount = indexedAccount?.associateAccount;
      address = associateAccount?.address;

      if (
        associateAccount?.addressDetail?.isValid &&
        associateAccount?.addressDetail?.normalizedAddress
      ) {
        allowEmptyAddress = true;
      }
    }
    if (
      !address &&
      !isOthersUniversal &&
      linkedNetworkId &&
      !allowEmptyAddress
    ) {
      // TODO custom style
      const r = {
        linkedNetworkId,
        address: '',
        isEmptyAddress: true,
      };
      return r;
    }
    const r = {
      linkedNetworkId: undefined,
      address: address
        ? accountUtils.shortenAddress({
            address,
          })
        : '',
      isEmptyAddress: false,
      hideAddress: isOthersUniversal ? false : hideAddress,
    };
    return r;
  }, [
    account?.address,
    indexedAccount?.associateAccount,
    isOthersUniversal,
    linkedNetworkId,
    hideAddress,
  ]);

  const subTitleInfo = useMemo(() => buildSubTitleInfo(), [buildSubTitleInfo]);

  const accountValue = useMemo(
    () => valuesMap?.[item.id],
    [valuesMap, item.id],
  );

  const accountDeFiOverview = useMemo(
    () => deFiMap?.[item.id],
    [deFiMap, item.id],
  );

  const shouldShowCreateAddressButton = useMemo(
    () => !!(linkNetwork && subTitleInfo.isEmptyAddress),
    [linkNetwork, subTitleInfo.isEmptyAddress],
  );

  const { avatarNetworkId } = useAccountSelectorAvatarNetwork({
    linkedNetworkId,
    selectedAccount,
    isOthersUniversal,
    account,
    indexedAccount,
    linkNetwork,
  });

  const actionButton = useMemo(() => {
    if (isCreatingAddress) {
      return null;
    }
    if (shouldShowCreateAddressButton) {
      return (
        <AccountSelectorCreateAddressButton
          num={num}
          selectAfterCreate
          account={{
            walletId: focusedWalletInfo?.wallet?.id,
            networkId: linkedNetworkId,
            indexedAccountId: indexedAccount?.id,
            deriveType: createAddressDeriveType ?? selectedAccount.deriveType,
          }}
          buttonRender={compact ? CompactPlusButton : PlusButton}
          // An embedded selector closes once the address exists and is
          // selected. A failed or cancelled creation reports no result and
          // leaves it open.
          onCreateDone={
            onAccountSelected
              ? (created) => {
                  if (created) {
                    onAccountSelected();
                  }
                }
              : undefined
          }
        />
      );
    }
    if (editable) {
      return (
        <AccountEditButton
          avatarNetworkId={avatarNetworkId}
          accountsCount={accountsCount}
          indexedAccount={indexedAccount}
          firstIndexedAccount={
            isOthersUniversal
              ? undefined
              : (section?.firstAccount as IDBIndexedAccount)
          }
          account={account}
          firstAccount={
            isOthersUniversal
              ? (section?.firstAccount as IDBAccount)
              : undefined
          }
          wallet={focusedWalletInfo?.wallet}
          networkId={linkedNetworkId ?? network?.id}
        />
      );
    }
    return null;
  }, [
    isCreatingAddress,
    compact,
    editable,
    shouldShowCreateAddressButton,
    avatarNetworkId,
    accountsCount,
    indexedAccount,
    isOthersUniversal,
    section?.firstAccount,
    account,
    focusedWalletInfo?.wallet,
    linkedNetworkId,
    network?.id,
    num,
    selectedAccount.deriveType,
    createAddressDeriveType,
    onAccountSelected,
  ]);

  const isSelected = useMemo(() => {
    if (isOthersUniversal) {
      return selectedAccount.othersWalletAccountId === item.id;
    }
    return selectedAccount.indexedAccountId === item.id;
  }, [
    isOthersUniversal,
    selectedAccount.othersWalletAccountId,
    selectedAccount.indexedAccountId,
    item.id,
  ]);

  const canConfirmAccountSelectPress = useMemo(
    () => allowSelectEmptyAccount || !shouldShowCreateAddressButton,
    [allowSelectEmptyAccount, shouldShowCreateAddressButton],
  );

  const renderAccountValue = useCallback(() => {
    // Gate on isEmptyAddress (the "address not created yet" signal that also
    // drives the create-address button) instead of the address string:
    // created Lightning accounts have an empty address text but should still
    // show their value, like BTC/LTC accounts that hide the address.
    if (
      platformEnv.isWebDappMode ||
      platformEnv.isE2E ||
      (linkNetwork && subTitleInfo.isEmptyAddress)
    )
      return null;

    return (
      <Stack flexShrink={1}>
        <AccountValueWithSpotlight
          size={compact ? '$bodySm' : '$bodyMd'}
          walletId={focusedWalletInfo?.wallet?.id ?? ''}
          enabledNetworksCompatibleWithWalletId={
            enabledNetworksCompatibleWithWalletId
          }
          networkInfoMap={networkInfoMap}
          isOthersUniversal={isOthersUniversal}
          index={index}
          accountValue={accountValue}
          accountDeFiOverview={accountDeFiOverview}
          indexedAccountId={indexedAccount?.id}
          linkedAccountId={indexedAccount?.associateAccount?.id ?? item.id}
          linkedNetworkId={avatarNetworkId ?? network?.id}
          mergeDeriveAssetsEnabled={mergeDeriveAssetsEnabled}
        />
      </Stack>
    );
  }, [
    linkNetwork,
    compact,
    subTitleInfo.isEmptyAddress,
    enabledNetworksCompatibleWithWalletId,
    networkInfoMap,
    focusedWalletInfo?.wallet?.id,
    isOthersUniversal,
    index,
    accountValue,
    indexedAccount?.id,
    indexedAccount?.associateAccount?.id,
    item.id,
    avatarNetworkId,
    network?.id,
    mergeDeriveAssetsEnabled,
    accountDeFiOverview,
  ]);

  const renderAccountAddress = useCallback(() => {
    return (
      <AccountAddress
        size={compact ? '$bodySm' : '$bodyMd'}
        num={num}
        linkedNetworkId={subTitleInfo.linkedNetworkId}
        address={accountUtils.shortenAddress({
          address: subTitleInfo.address,
          leadingLength: 6,
          trailingLength: 4,
        })}
        isEmptyAddress={subTitleInfo.isEmptyAddress}
        hideAddress={subTitleInfo.hideAddress}
        showSplitter={!(platformEnv.isWebDappMode || platformEnv.isE2E)}
      />
    );
  }, [
    num,
    compact,
    subTitleInfo.address,
    subTitleInfo.hideAddress,
    subTitleInfo.isEmptyAddress,
    subTitleInfo.linkedNetworkId,
  ]);

  // ListItem renders this prop as a component, so an inline arrow would be a
  // new element type on every render and React would remount the whole text
  // subtree instead of updating it in place.
  const renderItemText = useCallback(
    (textProps: IListItemTextProps) => (
      <ListItem.Text
        {...textProps}
        flex={1}
        // Without minWidth={0} the flex column keeps Yoga's default
        // `min-width: auto`, so it can't shrink below the intrinsic width of
        // its widest line (the value + address subtitle). On Android that
        // forces the column to overflow and the name's numberOfLines={1}
        // gets truncated against that inflated width — even short "Account #XX"
        // names get cut off (OK-56318). iOS lays this out without the issue.
        // Mirrors the working WebAccountPanelListItem pattern.
        minWidth={0}
        overflow="hidden"
        pr={compact ? '$0' : '$8'}
        primary={
          <SizableText size={compact ? '$bodyMd' : '$bodyLg'} numberOfLines={1}>
            {item.name}
          </SizableText>
        }
        secondary={
          <XStack
            key={`${focusedWalletInfo?.wallet?.id || ''}-${item.id}-${
              subTitleInfo.address
            }`}
            alignItems="center"
          >
            {renderAccountValue()}
            {renderAccountAddress()}
          </XStack>
        }
      />
    ),
    [
      compact,
      focusedWalletInfo?.wallet?.id,
      item.id,
      item.name,
      renderAccountAddress,
      renderAccountValue,
      subTitleInfo.address,
    ],
  );

  let compactAction = actionButton;
  if (isCreatingAddress) {
    compactAction = <Spinner size="small" />;
  } else if (isSelected && !shouldShowCreateAddressButton) {
    // The row of an account without an address cannot be pressed: its
    // create-address button stays, selected or not, as the only way to get
    // that address from this list.
    compactAction = (
      <Icon name="CheckRadioSolid" size="$5" color="$iconActive" />
    );
  }

  return (
    <Stack>
      <ListItem
        height={compact ? 48 : undefined}
        py={compact ? '$1.5' : '$2'}
        gap={compact ? '$2.5' : '$3'}
        // Balance the action button's internal inset against the avatar edge.
        pr={compact ? '$1' : '$3'}
        testID={AccountManagerTestIDs.accountItem(index)}
        key={item.id}
        renderAvatar={
          <AccountAvatar
            loading={
              <AccountAvatar.Loading
                w={compact ? '$6' : '$8'}
                h={compact ? '$6' : '$8'}
              />
            }
            loadingStrategy="static"
            size={compact ? 'small' : 'medium'}
            indexedAccount={indexedAccount}
            account={account as any}
            networkId={avatarNetworkId}
          />
        }
        renderItemText={renderItemText}
        {...(canConfirmAccountSelectPress && {
          onPress: async () => {
            // show CreateAddress Button here, disabled confirmAccountSelect()
            if (!allowSelectEmptyAccount && shouldShowCreateAddressButton) {
              return;
            }
            try {
              if (isOthersUniversal) {
                let autoChangeToAccountMatchedNetworkId = avatarNetworkId;
                if (
                  selectedAccount?.networkId &&
                  networkUtils.isAllNetwork({
                    networkId: selectedAccount?.networkId,
                  })
                ) {
                  autoChangeToAccountMatchedNetworkId =
                    selectedAccount?.networkId;
                }
                // Only home consumes these frames; other scenes must not
                // wait on home-only cache work before publishing selection.
                if (canPrewarmHomeTokenList) {
                  await prewarmHomeTokenListOwnerWithin(
                    {
                      networkId:
                        autoChangeToAccountMatchedNetworkId ??
                        selectedAccount?.networkId,
                      deriveType: selectedAccount?.deriveType,
                      othersWalletAccountId: account?.id,
                      currencyId: currencyInfo.id,
                    },
                    HOME_TOKEN_LIST_PREWARM_TAP_TIMEOUT_MS,
                  );
                }
                const confirmed = await actions.current.confirmAccountSelect({
                  num,
                  indexedAccount: undefined,
                  othersWalletAccount: account,
                  autoChangeToAccountMatchedNetworkId,
                  entry: 'accountList:othersWallet',
                  reason: 'userSelectAccount',
                });
                if (!confirmed) {
                  return;
                }
              } else if (focusedWalletInfo) {
                if (canPrewarmHomeTokenList) {
                  await prewarmHomeTokenListOwnerWithin(
                    {
                      networkId: selectedAccount?.networkId,
                      deriveType: selectedAccount?.deriveType,
                      indexedAccountId: indexedAccount?.id,
                      currencyId: currencyInfo.id,
                    },
                    HOME_TOKEN_LIST_PREWARM_TAP_TIMEOUT_MS,
                  );
                }
                const confirmed = await actions.current.confirmAccountSelect({
                  num,
                  indexedAccount,
                  othersWalletAccount: undefined,
                  autoChangeToAccountMatchedNetworkId: undefined,
                  entry: 'accountList:indexedAccount',
                  reason: 'userSelectAccount',
                });
                if (!confirmed) {
                  return;
                }
              }
            } catch {
              // confirmAccountSelect rejects when persisting the selection
              // fails. Keep the selector open - the selection is not saved
              // yet, and on the extension popup a selection that never
              // reached storage is lost once the popup is dismissed - and
              // surface the failure instead of leaving an unhandled
              // rejection behind a stuck modal.
              Toast.error({
                title: intl.formatMessage({
                  id: ETranslations.global_an_error_occurred,
                }),
                message: intl.formatMessage({
                  id: ETranslations.global_an_error_occurred_desc,
                }),
              });
              return;
            }
            if (onAccountSelected) {
              onAccountSelected();
            } else {
              resetAccountManagerStacksModal();
            }
          },
          isLoading: !compact && isCreatingAddress,
          userSelect: 'none',
        })}
        {...(isSelected &&
          !compact && {
            bg: '$bgActive',
          })}
      >
        {compact ? (
          <Stack
            width="$7"
            height="$7"
            flexShrink={0}
            alignItems="center"
            justifyContent="center"
          >
            {compactAction}
          </Stack>
        ) : null}
      </ListItem>
      {compact || isCreatingAddress ? null : (
        /* The value of top should be change if the height of the item is changed, since we can not use percentage value in translateY for keeping the Icon central aligned in React Native */
        <Stack position="absolute" right="$5" top={18}>
          {actionButton}
        </Stack>
      )}
    </Stack>
  );
}
