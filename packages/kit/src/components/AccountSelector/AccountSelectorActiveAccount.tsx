import {
  Button,
  SizableText,
  Toast,
  Tooltip,
  XStack,
} from '@onekeyhq/components';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import {
  useAccountSelectorActions,
  useActiveAccount,
  useSelectedAccount,
} from '../../states/jotai/contexts/accountSelector';

export function AccountSelectorActiveAccount({ num }: { num: number }) {
  const { serviceAccount } = backgroundApiProxy;
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    activeAccount: { wallet, network, account, indexedAccount },
  } = useActiveAccount({ num });
  const actions = useAccountSelectorActions();

  const { selectedAccount } = useSelectedAccount({ num });

  return (
    <>
      <SizableText>
        {'>>>>>>'} {wallet?.name} -- {network?.name} --{' '}
        {/* {JSON.stringify(indexedAccount)} */}
        {selectedAccount?.deriveType}/{selectedAccount.indexedAccountId} --{' '}
        {account?.name}
      </SizableText>
      {account?.address ? (
        <>
          <SizableText>
            {accountUtils.shortenAddress({
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
    </>
  );
}

export function AccountSelectorActiveAccountHome({ num }: { num: number }) {
  const { serviceAccount } = backgroundApiProxy;
  const {
    activeAccount: { account },
  } = useActiveAccount({ num });
  const actions = useAccountSelectorActions();

  const { selectedAccount } = useSelectedAccount({ num });

  // show address if account has an address
  if (account?.address) {
    return (
      <Tooltip
        renderContent="Copy to clipboard"
        placement="top"
        renderTrigger={
          <XStack
            alignItems="center"
            onPress={() =>
              Toast.success({
                title: 'Copied',
              })
            }
            p="$1"
            px="$2"
            my="$-1"
            ml="$1"
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
          >
            <SizableText userSelect="none" size="$bodyMd" color="$textSubdued">
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
