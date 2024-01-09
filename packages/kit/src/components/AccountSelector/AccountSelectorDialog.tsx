import { useEffect } from 'react';

import { Accordion, Paragraph, Square } from 'tamagui';

import { Button, SizableText } from '@onekeyhq/components';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import {
  useAccountSelectorActions,
  useSelectedAccount,
} from '../../states/jotai/contexts/accountSelector';

import { AccountSelectorActiveAccount } from './AccountSelectorActiveAccount';
import { DeriveTypeSelectorTrigger } from './DeriveTypeSelectorTrigger';
import { NetworkSelectorTrigger } from './NetworkSelectorTrigger';

const { serviceAccount } = backgroundApiProxy;
export function AccountSelectorDialog({ num }: { num: number }) {
  useEffect(
    () => () => {
      console.log('DemoAccountSelector unload');
    },
    [],
  );

  const { selectedAccount } = useSelectedAccount({ num });
  const actions = useAccountSelectorActions();

  const { result: walletsResult } = usePromiseResult(
    () => serviceAccount.getWallets(),
    [],
  );
  const wallets = walletsResult?.wallets;

  const { result: accountsResult, run: refreshAccounts } =
    usePromiseResult(async () => {
      if (!selectedAccount?.focusedWallet) {
        return Promise.resolve(undefined);
      }
      return serviceAccount.getAccountsOfWallet({
        walletId: selectedAccount?.focusedWallet,
      });
    }, [selectedAccount?.focusedWallet]);
  const accounts = accountsResult?.accounts;

  return (
    <>
      <SizableText size="$headingXl">
        账户选择器 {selectedAccount?.indexedAccountId}
      </SizableText>
      <SizableText>
        focusedWallet({wallets?.length}): {selectedAccount.focusedWallet}
      </SizableText>

      {wallets?.length && wallets?.length > 0 ? (
        <Accordion
          overflow="hidden"
          width="full"
          type="single"
          value={selectedAccount.focusedWallet}
          onValueChange={(id) =>
            actions.current.updateSelectedAccount({
              num,
              builder: (v) => ({
                ...v,
                focusedWallet: id,
              }),
            })
          }
        >
          {wallets?.map((wallet) => {
            if (!accountUtils.isHdWallet({ walletId: wallet.id })) {
              return null;
            }
            return (
              <Accordion.Item key={wallet.id} value={wallet.id}>
                <Accordion.Trigger
                  flexDirection="row"
                  justifyContent="space-between"
                >
                  {({ open }: { open: boolean }) => (
                    <>
                      <Paragraph>
                        {wallet.avatarInfo?.emoji} {wallet.name} ({wallet.id}) [
                        {accounts?.length}]
                      </Paragraph>
                      <Square
                        animation="quick"
                        rotate={open ? '90deg' : '0deg'}
                      >
                        <Text>➡️</Text>
                      </Square>
                    </>
                  )}
                </Accordion.Trigger>
                <Accordion.Content backgroundColor="#eee">
                  {accounts?.map((a) => (
                    <SizableText
                      onPress={() => {
                        actions.current.updateSelectedAccount({
                          num,
                          builder: (v) => ({
                            ...v,
                            walletId: wallet.id,
                            accountId: undefined,
                            indexedAccountId: a.id,
                          }),
                        });
                      }}
                      key={a.id}
                    >
                      {a.name} ({a?.walletId}) index={a.index}
                      {'   '}
                      {selectedAccount.indexedAccountId === a.id ? '✅' : ''}
                    </SizableText>
                  ))}
                  <Button
                    onPress={async () => {
                      const c = await serviceAccount.addHDNextIndexedAccount({
                        walletId: wallet.id,
                      });
                      console.log(c);
                      await refreshAccounts();
                    }}
                  >
                    + Add Account
                  </Button>
                </Accordion.Content>
              </Accordion.Item>
            );
          })}
        </Accordion>
      ) : null}

      <NetworkSelectorTrigger num={num} />

      <DeriveTypeSelectorTrigger num={num} />

      <SizableText size="$headingXl">当前账户</SizableText>
      {/* <Suspense></Suspense> */}
      <AccountSelectorActiveAccount num={num} />
    </>
  );
}
