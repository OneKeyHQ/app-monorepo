import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button, Page, SizableText, Stack, Toast } from '@onekeyhq/components';
import { AccountSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector';
import { NetworkSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector/NetworkSelectorTrigger';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import useDappApproveAction from '../../../hooks/useDappApproveAction';
import useDappQuery from '../../../hooks/useDappQuery';
import {
  useAccountSelectorActions,
  useActiveAccount,
} from '../../../states/jotai/contexts/accountSelector';
import DAppRequestHeader from '../components/DAppRequestHeader';

import type { IAccountSelectorActiveAccountInfo } from '../../../states/jotai/contexts/accountSelector';

function DAppAccountSelector({
  num,
  origin,
  onSelectedAccount,
}: {
  num: number;
  origin: string;
  onSelectedAccount: (activeAccount: IAccountSelectorActiveAccountInfo) => void;
}) {
  const { serviceAccount } = backgroundApiProxy;
  const { activeAccount } = useActiveAccount({
    num,
  });
  const { wallet, account, indexedAccount, network } = activeAccount;
  const actions = useAccountSelectorActions();

  useEffect(() => {
    // watch wallet change
    console.log('activeAccount change', activeAccount);
    if (activeAccount) {
      onSelectedAccount(activeAccount);
    }
  }, [activeAccount, onSelectedAccount]);

  const createAccountButton = useMemo(() => {
    if (account) {
      return <SizableText>{account.address}</SizableText>;
    }
    if (indexedAccount && !account) {
      return (
        <Button
          onPress={async () => {
            const c = await serviceAccount.addHDOrHWAccounts({
              walletId: wallet?.id,
              networkId: network?.id,
              indexedAccountId: indexedAccount?.id,
              deriveType: 'default',
            });

            console.log(c);
            actions.current.refresh({ num: 0 });
          }}
        >
          创建账户
        </Button>
      );
    }
    return null;
  }, [account, indexedAccount, serviceAccount, wallet, actions, network?.id]);

  return (
    <Stack>
      <SizableText>{origin}</SizableText>
      <AccountSelectorTriggerHome
        num={num}
        sceneName={EAccountSelectorSceneName.discover}
        sceneUrl={origin}
      />
      <NetworkSelectorTriggerHome num={num} />
      {createAccountButton}
    </Stack>
  );
}

function ConnectionModal() {
  const { serviceDApp } = backgroundApiProxy;
  const { $sourceInfo } = useDappQuery();
  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const [accountSelectorNum, setAccountSelectorNum] = useState<number | null>(
    null,
  );
  useEffect(() => {
    if (!$sourceInfo?.origin || !$sourceInfo.scope) {
      return;
    }
    serviceDApp
      .getAccountSelectorNum({
        origin: $sourceInfo.origin,
        scope: $sourceInfo.scope ?? '',
      })
      .then((num) => {
        setAccountSelectorNum(num);
      })
      .catch((e) => {
        console.error('getAccountSelectorNum error: ', e);
      });
  }, [$sourceInfo?.origin, $sourceInfo?.scope, serviceDApp]);

  const selectedAccountRef = useRef<IAccountSelectorActiveAccountInfo | null>(
    null,
  );

  const onApproval = useCallback(
    async ({ close }: { close: () => void }) => {
      if (!$sourceInfo?.scope) {
        Toast.error({ title: 'no injected scope' });
        return;
      }
      if (!selectedAccountRef.current || !selectedAccountRef.current.account) {
        Toast.error({ title: 'no account' });
        return;
      }
      const { wallet, account, network, indexedAccount } =
        selectedAccountRef.current;
      const accountInfo = {
        networkImpl: network?.impl ?? '',
        walletId: wallet?.id ?? '',
        indexedAccountId: indexedAccount?.id ?? '',
        networkId: network?.id ?? '',
        accountId: account.id,
        address: account.address,
      };
      await serviceDApp.saveConnectionSession({
        origin: $sourceInfo?.origin,
        accountsInfo: [accountInfo],
        storageType: 'injectedProvider',
      });
      await dappApprove.resolve({
        close,
        result: accountInfo,
      });
    },
    [dappApprove, $sourceInfo?.origin, $sourceInfo?.scope, serviceDApp],
  );

  return (
    <Page>
      <Page.Header headerShown={false} />
      <Page.Body>
        {accountSelectorNum === null ? null : (
          <>
            <DAppRequestHeader />
            <AccountSelectorProviderMirror
              config={{
                sceneName: EAccountSelectorSceneName.discover,
                sceneUrl: $sourceInfo?.origin,
              }}
              enabledNum={[accountSelectorNum]}
            >
              <DAppAccountSelector
                num={accountSelectorNum}
                origin={$sourceInfo?.origin ?? ''}
                onSelectedAccount={(activeAccount) => {
                  selectedAccountRef.current = activeAccount;
                }}
              />
            </AccountSelectorProviderMirror>
          </>
        )}
      </Page.Body>
      <Page.Footer
        onConfirmText="Connect"
        onCancelText="Cancel"
        onConfirm={onApproval}
        onCancel={() => {
          dappApprove.reject();
        }}
      />
    </Page>
  );
}

export default ConnectionModal;
