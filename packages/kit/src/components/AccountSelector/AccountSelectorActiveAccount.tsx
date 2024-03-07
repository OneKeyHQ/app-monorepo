import { useState } from 'react';

import {
  Button,
  SizableText,
  Tooltip,
  XStack,
  useClipboard,
} from '@onekeyhq/components';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import {
  useAccountSelectorActions,
  useActiveAccount,
  useSelectedAccount,
} from '../../states/jotai/contexts/accountSelector';

import { AccountSelectorSyncButton } from './AccountSelectorSyncButton';

export function AccountSelectorActiveAccountLegacy({ num }: { num: number }) {
  const { serviceAccount } = backgroundApiProxy;
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    activeAccount: { wallet, network, account, indexedAccount },
  } = useActiveAccount({ num });
  const actions = useAccountSelectorActions();

  const [showFullAddress, setShowFullAddress] = useState(false);

  const { selectedAccount } = useSelectedAccount({ num });

  return (
    <>
      <SizableText>
        {'>>>>>>'} {wallet?.name} -- {network?.name} --{' '}
        {/* {JSON.stringify(indexedAccount)} */}
        {selectedAccount?.deriveType}/{selectedAccount.indexedAccountId} --{' '}
        {account?.name}
        {selectedAccount.focusedWallet}
      </SizableText>

      {account?.address ? (
        <>
          <SizableText onPress={() => setShowFullAddress((v) => !v)}>
            {showFullAddress
              ? account.address || ''
              : accountUtils.shortenAddress({
                  address: account?.address || '',
                })}
          </SizableText>
          <SizableText>{account?.id}</SizableText>
          <SizableText>{account?.path}</SizableText>
        </>
      ) : (
        <Button
          onPress={async () => {
            if (!selectedAccount) {
              return;
            }
            const c = await serviceAccount.addHDOrHWAccounts({
              walletId: selectedAccount?.walletId,
              networkId: selectedAccount?.networkId,
              indexedAccountId: selectedAccount?.indexedAccountId,
              deriveType: selectedAccount?.deriveType,
            });
            console.log(c);
            // await refreshCurrentAccount();
            actions.current.refresh({ num });
          }}
        >
          暂无账户，点击创建
        </Button>
      )}
      <AccountSelectorSyncButton
        from={{
          sceneName: EAccountSelectorSceneName.home,
          sceneNum: 0,
        }}
        num={num}
      />
      <XStack h="$4" />
    </>
  );
}

export function AccountSelectorActiveAccountHome({ num }: { num: number }) {
  const { serviceAccount } = backgroundApiProxy;
  const { activeAccount } = useActiveAccount({ num });
  const actions = useAccountSelectorActions();
  const { copyText } = useClipboard();
  const { account } = activeAccount;

  const { selectedAccount } = useSelectedAccount({ num });

  // show address if account has an address
  if (account?.address) {
    return (
      <Tooltip
        renderContent="Address"
        placement="top"
        renderTrigger={
          <XStack
            alignItems="center"
            onPress={() => {
              copyText(account.address);
              console.log({
                selectedAccount,
                activeAccount,
                walletAvatar: activeAccount?.wallet?.avatar,
              });
              console.log(activeAccount?.wallet?.avatar);
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

  // show nothing if account has not an address
  if (account) {
    return null;
  }

  // show create button if account not exists
  return (
    <Button
      size="small"
      onPress={async () => {
        console.log({
          selectedAccount,
          activeAccount,
        });
        if (!selectedAccount) {
          return;
        }
        const c = await serviceAccount.addHDOrHWAccounts({
          walletId: selectedAccount?.walletId,
          networkId: selectedAccount?.networkId,
          indexedAccountId: selectedAccount?.indexedAccountId,
          deriveType: selectedAccount?.deriveType,
        });
        console.log(c);
        // await refreshCurrentAccount();
        actions.current.refresh({ num });
      }}
    >
      Create
    </Button>
  );
}
