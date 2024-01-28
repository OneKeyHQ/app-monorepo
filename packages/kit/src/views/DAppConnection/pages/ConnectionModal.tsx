import { useCallback, useMemo, useRef, useState } from 'react';

import { throttle } from 'lodash';
import { useIntl } from 'react-intl';

import { Page, Toast } from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useDappApproveAction from '../../../hooks/useDappApproveAction';
import useDappQuery from '../../../hooks/useDappQuery';
import { DAppAccountListStandAloneItem } from '../components/DAppAccountList';
import { DAppRequestedPermissionContent } from '../components/DAppRequestContent';
import {
  DAppRequestFooter,
  DAppRequestLayout,
} from '../components/DAppRequestLayout';
import { useRiskDetection } from '../hooks/useRiskDetection';

import type { IAccountSelectorActiveAccountInfo } from '../../../states/jotai/contexts/accountSelector';
import type { IHandleAccountChanged } from '../components/DAppAccountList';

function ConnectionModal() {
  const intl = useIntl();
  const { serviceDApp } = backgroundApiProxy;
  const { $sourceInfo } = useDappQuery();
  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });
  const { continueOperate, setContinueOperate, canContinueOperate, riskLevel } =
    useRiskDetection({ origin: $sourceInfo?.origin ?? '' });

  const [selectedAccount, setSelectedAccount] =
    useState<IAccountSelectorActiveAccountInfo | null>(null);
  // Throttling is required to prevent an infinite loop caused by multiple renderings of `activeAccount` on mobile devices.
  const throttledSetSelectedAccount = useRef(
    throttle((activeAccount) => {
      setSelectedAccount(activeAccount);
      console.log(
        'connectionmodal setActiveAccount: ',
        JSON.stringify(activeAccount),
      );
    }, 500),
  ).current;
  const handleAccountChanged = useCallback<IHandleAccountChanged>(
    (activeAccount) => {
      throttledSetSelectedAccount(activeAccount);
    },
    [throttledSetSelectedAccount],
  );

  const confirmDisabled = useMemo(() => {
    if (!canContinueOperate) {
      return true;
    }
    if (
      !selectedAccount ||
      !selectedAccount.account ||
      !selectedAccount.account.address
    ) {
      return true;
    }
    return false;
  }, [selectedAccount, canContinueOperate]);

  const onApproval = useCallback(
    async ({ close }: { close: () => void }) => {
      if (!$sourceInfo?.scope) {
        Toast.error({ title: 'no injected scope' });
        return;
      }
      if (!selectedAccount || !selectedAccount.account) {
        Toast.error({ title: 'no account' });
        return;
      }
      const { wallet, account, network, indexedAccount } = selectedAccount;
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
      Toast.success({
        title: intl.formatMessage({
          id: 'content__connected',
        }),
      });
    },
    [
      intl,
      dappApprove,
      $sourceInfo?.origin,
      $sourceInfo?.scope,
      serviceDApp,
      selectedAccount,
    ],
  );

  return (
    <Page>
      <Page.Header headerShown={false} />
      <Page.Body>
        <DAppRequestLayout
          title="Connection Request"
          origin={$sourceInfo?.origin ?? ''}
          riskLevel={riskLevel}
        >
          <DAppAccountListStandAloneItem
            handleAccountChanged={handleAccountChanged}
          />
          <DAppRequestedPermissionContent />
        </DAppRequestLayout>
      </Page.Body>
      <Page.Footer>
        <DAppRequestFooter
          continueOperate={continueOperate}
          setContinueOperate={(value) => setContinueOperate(!!value)}
          onConfirm={onApproval}
          onCancel={() => {
            dappApprove.reject();
          }}
          confirmButtonProps={{
            disabled: confirmDisabled,
          }}
          showContinueOperateCheckbox={riskLevel !== 'Verified'}
        />
      </Page.Footer>
    </Page>
  );
}

export default ConnectionModal;
