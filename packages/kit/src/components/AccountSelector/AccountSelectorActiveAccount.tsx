import { useCallback } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  SizableText,
  Tooltip,
  XStack,
  useClipboard,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IModalReceiveParamList } from '@onekeyhq/shared/src/routes';
import { EModalReceiveRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import {
  useActiveAccount,
  useSelectedAccount,
} from '../../states/jotai/contexts/accountSelector';

import { AccountSelectorCreateAddressButton } from './AccountSelectorCreateAddressButton';

export function AccountSelectorActiveAccountHome({ num }: { num: number }) {
  const { activeAccount } = useActiveAccount({ num });
  const { copyText } = useClipboard();
  const { account, wallet, network, deriveType, deriveInfo } = activeAccount;

  const { selectedAccount } = useSelectedAccount({ num });

  const navigation =
    useAppNavigation<IPageNavigationProp<IModalReceiveParamList>>();

  const logActiveAccount = useCallback(() => {
    console.log({
      selectedAccount,
      addressDetail: activeAccount?.account?.addressDetail,
      activeAccount,
      walletAvatar: activeAccount?.wallet?.avatar,
    });
    console.log(activeAccount?.wallet?.avatar);
  }, [activeAccount, selectedAccount]);

  const handleAddressOnPress = useCallback(() => {
    if (!account || !network || !deriveInfo || !wallet) return;
    if (
      wallet?.id &&
      (accountUtils.isHwWallet({
        walletId: wallet?.id,
      }) ||
        accountUtils.isQrWallet({
          walletId: wallet?.id,
        }))
    ) {
      navigation.pushModal(EModalRoutes.ReceiveModal, {
        screen: EModalReceiveRoutes.ReceiveToken,
        params: {
          networkId: network.id,
          accountId: account.id,
          walletId: wallet.id,
          deriveInfo,
          deriveType,
        },
      });
    } else {
      copyText(account.address);
    }
    logActiveAccount();
  }, [
    account,
    copyText,
    deriveInfo,
    deriveType,
    logActiveAccount,
    navigation,
    network,
    wallet,
  ]);

  // show address if account has an address
  if (account?.address) {
    return (
      <Tooltip
        renderContent="Copy Address"
        placement="top"
        renderTrigger={
          <XStack
            alignItems="center"
            onPress={handleAddressOnPress}
            py="$1"
            px="$2"
            my="$-1"
            mx="$-2"
            borderRadius="$2"
            hoverStyle={{
              bg: '$bgHover',
            }}
            pressStyle={{
              bg: '$bgActive',
            }}
            focusable
            focusStyle={{
              outlineWidth: 2,
              outlineColor: '$focusRing',
              outlineStyle: 'solid',
            }}
            $platform-native={{
              hitSlop: {
                top: 8,
                right: 8,
                bottom: 8,
              },
            }}
            userSelect="none"
          >
            <SizableText size="$bodyMd">
              {accountUtils.shortenAddress({ address: account?.address })}
            </SizableText>
          </XStack>
        }
      />
    );
  }

  // show nothing if account exists, but has not an address
  if (account) {
    return null;
  }

  if (
    !account &&
    selectedAccount.othersWalletAccountId &&
    !selectedAccount.indexedAccountId
  ) {
    return (
      <XStack onPress={() => logActiveAccount()}>
        <SizableText size="$bodyMd" color="$textCaution">
          Network not matched
        </SizableText>
      </XStack>
    );
  }

  // show create button if account not exists
  return (
    <AccountSelectorCreateAddressButton num={num} account={selectedAccount} />
  );
}
