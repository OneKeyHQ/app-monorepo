import { useCallback, useMemo } from 'react';

import type { IButtonProps } from '@onekeyhq/components';
import { IconButton, SizableText, Stack, XStack } from '@onekeyhq/components';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import { AccountSelectorCreateAddressButton } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorCreateAddressButton';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
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
import { useIndexedAccountAddressCreationStateAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { AccountEditButton } from '../../../components/AccountEdit';

import { AccountAddress } from './AccountAddress';
import { AccountValueWithSpotlight } from './AccountValue';

function PlusButton({ onPress, loading }: IButtonProps) {
  return (
    <IconButton
      borderWidth={0}
      borderRadius="$2"
      variant="tertiary"
      size="medium"
      loading={loading}
      onPress={onPress}
      icon="PlusSmallOutline"
    />
  );
}

export function AccountSelectorAccountListItem({
  num,
  linkedNetworkId,
  item,
  section,
  index,
  isOthersUniversal,
  selectedAccount,
  accountsValue,
  linkNetwork,
  editMode,
  accountsCount,
  focusedWalletInfo,
}: {
  num: number;
  linkedNetworkId: string | undefined;
  item: IDBIndexedAccount | IDBAccount;
  section: IAccountSelectorAccountsListSectionData;
  index: number;
  isOthersUniversal: boolean;
  selectedAccount: IAccountSelectorSelectedAccount;
  accountsValue: {
    accountId: string;
    value: Record<string, string> | string | undefined;
    currency: string | undefined;
  }[];
  linkNetwork: boolean | undefined;
  editMode: boolean;
  accountsCount: number;
  focusedWalletInfo:
    | {
        wallet: IDBWallet;
        device: IDBDevice | undefined;
      }
    | undefined;
}) {
  const actions = useAccountSelectorActions();
  const navigation = useAppNavigation();

  const [addressCreationState] = useIndexedAccountAddressCreationStateAtom();

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
      return {
        linkedNetworkId,
        address: '',
        isEmptyAddress: true,
      };
    }
    return {
      linkedNetworkId: undefined,
      address: address
        ? accountUtils.shortenAddress({
            address,
          })
        : '',
      isEmptyAddress: false,
    };
  }, [
    account?.address,
    indexedAccount?.associateAccount,
    isOthersUniversal,
    linkedNetworkId,
  ]);

  const subTitleInfo = useMemo(() => buildSubTitleInfo(), [buildSubTitleInfo]);

  // TODO performance
  const accountValue = useMemo(
    () => accountsValue?.find((i) => i.accountId === item.id),
    [accountsValue, item.id],
  );

  const shouldShowCreateAddressButton = useMemo(
    () => !!(linkNetwork && subTitleInfo.isEmptyAddress),
    [linkNetwork, subTitleInfo.isEmptyAddress],
  );

  const actionButton = useMemo(() => {
    if (editMode) {
      return (
        <>
          {/* TODO rename to AccountEditTrigger */}
          <AccountEditButton
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
          />
        </>
      );
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
            deriveType: selectedAccount.deriveType,
          }}
          buttonRender={PlusButton}
        />
      );
    }
    return null;
  }, [
    editMode,
    accountsCount,
    indexedAccount,
    isOthersUniversal,
    section?.firstAccount,
    account,
    focusedWalletInfo?.wallet,
    shouldShowCreateAddressButton,
    num,
    linkedNetworkId,
    selectedAccount.deriveType,
  ]);

  const avatarNetworkId: string | undefined = useMemo(() => {
    let _avatarNetworkId: string | undefined;
    if (isOthersUniversal && account) {
      _avatarNetworkId = accountUtils.getAccountCompatibleNetwork({
        account,
        networkId: linkNetwork
          ? selectedAccount?.networkId
          : account.createAtNetwork,
      });
    }
    if (!_avatarNetworkId && indexedAccount && linkNetwork) {
      _avatarNetworkId = selectedAccount?.networkId;
    }
    return _avatarNetworkId;
  }, [
    account,
    indexedAccount,
    isOthersUniversal,
    linkNetwork,
    selectedAccount?.networkId,
  ]);

  const canConfirmAccountSelectPress = useMemo(
    () => !editMode && !shouldShowCreateAddressButton,
    [editMode, shouldShowCreateAddressButton],
  );

  const renderAccountValue = useCallback(() => {
    if (platformEnv.isE2E || (linkNetwork && !subTitleInfo.address))
      return null;

    return (
      <>
        <AccountValueWithSpotlight
          isOthersUniversal={isOthersUniversal}
          index={index}
          accountValue={accountValue}
          linkedAccountId={indexedAccount?.associateAccount?.id}
          linkedNetworkId={avatarNetworkId}
        />
        {subTitleInfo.address ? (
          <Stack
            mx="$1.5"
            w="$1"
            h="$1"
            bg="$iconSubdued"
            borderRadius="$full"
          />
        ) : null}
      </>
    );
  }, [
    linkNetwork,
    subTitleInfo.address,
    isOthersUniversal,
    index,
    accountValue,
    indexedAccount?.associateAccount?.id,
    avatarNetworkId,
  ]);

  return (
    <ListItem
      testID={`account-item-index-${index}`}
      key={item.id}
      renderAvatar={
        <AccountAvatar
          loading={<AccountAvatar.Loading w="$10" h="$10" />}
          indexedAccount={indexedAccount}
          account={account as any}
          networkId={avatarNetworkId}
        />
      }
      renderItemText={(textProps) => (
        <ListItem.Text
          {...textProps}
          flex={1}
          primary={
            <SizableText size="$bodyLgMedium" numberOfLines={1}>
              {item.name}
            </SizableText>
          }
          secondary={
            <XStack alignItems="center">
              {renderAccountValue()}
              <AccountAddress
                num={num}
                linkedNetworkId={subTitleInfo.linkedNetworkId}
                address={subTitleInfo.address}
                isEmptyAddress={subTitleInfo.isEmptyAddress}
              />
            </XStack>
          }
        />
      )}
      {...(!editMode && {
        onPress: canConfirmAccountSelectPress
          ? async () => {
              // show CreateAddress Button here, disabled confirmAccountSelect()
              if (shouldShowCreateAddressButton) {
                return;
              }
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
                await actions.current.confirmAccountSelect({
                  num,
                  indexedAccount: undefined,
                  othersWalletAccount: account,
                  autoChangeToAccountMatchedNetworkId,
                });
              } else if (focusedWalletInfo) {
                await actions.current.confirmAccountSelect({
                  num,
                  indexedAccount,
                  othersWalletAccount: undefined,
                  autoChangeToAccountMatchedNetworkId: undefined,
                });
              }
              navigation.popStack();
            }
          : undefined,
        isLoading: isCreatingAddress,
        // TODO useMemo
        checkMark: (() => {
          if (isCreatingAddress) {
            return undefined;
          }
          // show CreateAddress Button here, hide checkMark
          if (shouldShowCreateAddressButton) {
            return undefined;
          }
          return isOthersUniversal
            ? selectedAccount.othersWalletAccountId === item.id
            : selectedAccount.indexedAccountId === item.id;
        })(),
        userSelect: 'none',
      })}
    >
      {actionButton}
    </ListItem>
  );
}
