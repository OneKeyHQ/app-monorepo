import { useCallback, useEffect, useMemo, useRef } from 'react';

import { Button, Page, SizableText, Stack, Toast } from '@onekeyhq/components';
import { AccountSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector';
import { NetworkSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector/NetworkSelectorTrigger';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IConnectionItem } from '@onekeyhq/shared/types/dappConnection';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import useDappApproveAction from '../../../hooks/useDappApproveAction';
import useDappQuery from '../../../hooks/useDappQuery';
import {
  useAccountSelectorActions,
  useActiveAccount,
} from '../../../states/jotai/contexts/accountSelector';

import type { IAccountSelectorActiveAccountInfo } from '../../../states/jotai/contexts/accountSelector';

function DAppAccountSelector({
  origin,
  onSelectedAccount,
}: {
  origin: string;
  onSelectedAccount: (activeAccount: IAccountSelectorActiveAccountInfo) => void;
}) {
  const { serviceAccount } = backgroundApiProxy;
  const networkId = 'evm--1';
  const { activeAccount } = useActiveAccount({
    num: 0,
  });
  const { wallet, account, indexedAccount } = activeAccount;
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
              networkId,
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
  }, [account, indexedAccount, serviceAccount, wallet, actions]);

  return (
    <Stack>
      <SizableText>{origin}</SizableText>
      <AccountSelectorTriggerHome
        num={0}
        sceneName={EAccountSelectorSceneName.discover}
        sceneUrl={origin}
      />
      <NetworkSelectorTriggerHome
        num={0}
        sceneName={EAccountSelectorSceneName.discover}
        sceneUrl={origin}
      />
      {createAccountButton}
    </Stack>
  );
}

function ConnectionModal() {
  const { serviceDApp, serviceDiscovery } = backgroundApiProxy;
  const { $sourceInfo } = useDappQuery();
  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const selectedAccountRef = useRef<IAccountSelectorActiveAccountInfo | null>(
    null,
  );

  const onApproval = useCallback(
    async ({ close }: { close: () => void }) => {
      if (!selectedAccountRef.current || !selectedAccountRef.current.account) {
        Toast.error({ title: 'no account' });
        return;
      }
      const { wallet, account, network, indexedAccount } =
        selectedAccountRef.current;
      const connectionInfo = {
        walletId: wallet?.id ?? '',
        networkId: network?.id ?? '',
        indexedAccountId: indexedAccount?.id ?? '',
        accountId: account.id,
      };
      const result: IConnectionItem = {
        title: $sourceInfo?.hostname ?? '',
        origin: $sourceInfo?.origin ?? '',
        imageURL: await serviceDiscovery.getWebsiteIcon(
          $sourceInfo?.origin ?? '',
          128,
        ),
        connection: [connectionInfo],
        enabledFor: [],
      };
      await serviceDApp.saveConnectionSession(result);
      await dappApprove.resolve({
        close,
        result,
      });
    },
    [
      dappApprove,
      $sourceInfo?.hostname,
      $sourceInfo?.origin,
      serviceDApp,
      serviceDiscovery,
    ],
  );

  return (
    <Page>
      <Page.Header title="Connection Modal" />
      <Page.Body>
        {$sourceInfo?.origin ? (
          <AccountSelectorProviderMirror
            config={{
              sceneName: EAccountSelectorSceneName.discover,
              sceneUrl: $sourceInfo.origin,
            }}
            enabledNum={[0]}
          >
            <DAppAccountSelector
              origin={$sourceInfo.origin}
              onSelectedAccount={(activeAccount) => {
                selectedAccountRef.current = activeAccount;
              }}
            />
          </AccountSelectorProviderMirror>
        ) : null}
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
