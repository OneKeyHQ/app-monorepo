import { useCallback, useRef, useState } from 'react';

import { Page, Toast } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useDappApproveAction from '../../../hooks/useDappApproveAction';
import useDappQuery from '../../../hooks/useDappQuery';
import { DAppAccountListStandAloneItem } from '../components/DAppAccountList';
import { DAppRequestedPermissionContent } from '../components/DAppRequestContent';
import {
  DAppRequestFooter,
  DAppRequestLayout,
} from '../components/DAppRequestLayout';

import type { IAccountSelectorActiveAccountInfo } from '../../../states/jotai/contexts/accountSelector';

function ConnectionModal() {
  const { serviceDApp } = backgroundApiProxy;
  const { $sourceInfo } = useDappQuery();
  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });
  const [continueOperate, setContinueOperate] = useState(false);
  const { pop } = useAppNavigation();

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
        <DAppRequestLayout title="Connection Request">
          <DAppAccountListStandAloneItem />
          <DAppRequestedPermissionContent />
        </DAppRequestLayout>
      </Page.Body>
      <Page.Footer>
        <DAppRequestFooter
          continueOperate={continueOperate}
          setContinueOperate={(value) => setContinueOperate(!!value)}
          onConfirm={() => {
            void onApproval({ close: pop });
          }}
          onCancel={() => {
            dappApprove.reject();
            pop();
          }}
        />
      </Page.Footer>
    </Page>
  );
}

export default ConnectionModal;
