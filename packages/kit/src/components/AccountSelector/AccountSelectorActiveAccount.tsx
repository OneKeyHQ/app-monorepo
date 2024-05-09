import { useCallback } from 'react';

import {
  SizableText,
  Tooltip,
  XStack,
  useClipboard,
} from '@onekeyhq/components';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import {
  useActiveAccount,
  useSelectedAccount,
} from '../../states/jotai/contexts/accountSelector';

import { AccountSelectorCreateAddressButton } from './AccountSelectorCreateAddressButton';

export function AccountSelectorActiveAccountHome({ num }: { num: number }) {
  const { activeAccount } = useActiveAccount({ num });
  const { copyText } = useClipboard();
  const { account } = activeAccount;

  const { selectedAccount } = useSelectedAccount({ num });
  const logActiveAccount = useCallback(() => {
    console.log({
      selectedAccount,
      addressDetail: activeAccount?.account?.addressDetail,
      activeAccount,
      walletAvatar: activeAccount?.wallet?.avatar,
    });
    console.log(activeAccount?.wallet?.avatar);
  }, [activeAccount, selectedAccount]);

  // show address if account has an address
  if (account?.address) {
    return (
      <Tooltip
        renderContent="Copy Address"
        placement="top"
        renderTrigger={
          <XStack
            alignItems="center"
            onPress={() => {
              copyText(account.address);
              logActiveAccount();
            }}
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
