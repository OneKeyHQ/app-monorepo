import { useCallback, useMemo, useState } from 'react';

import { isNumber } from 'lodash';
import { useIntl } from 'react-intl';

import { Page, Toast } from '@onekeyhq/components';
import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import type { IConnectionAccountInfo } from '@onekeyhq/shared/types/dappConnection';
import { EConnectionType } from '@onekeyhq/shared/types/dappConnection';
import { EHostSecurityLevel } from '@onekeyhq/shared/types/discovery';

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
import type { IHandleAccountChanged } from '../hooks/useHandleAccountChanged';

function ConnectionModal() {
  const intl = useIntl();
  const { serviceDApp } = backgroundApiProxy;
  const { $sourceInfo, connectType } = useDappQuery<{
    connectType?: EConnectionType;
  }>();
  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });
  const {
    continueOperate,
    setContinueOperate,
    canContinueOperate,
    riskLevel,
    urlSecurityInfo,
  } = useRiskDetection({ origin: $sourceInfo?.origin ?? '' });

  const [selectedAccount, setSelectedAccount] =
    useState<IAccountSelectorActiveAccountInfo | null>(null);

  const [rawSelectedAccount, setRawSelectedAccount] =
    useState<IAccountSelectorSelectedAccount | null>(null);

  const [accountSelectorNum, setAccountSelectorNum] = useState<number | null>(
    null,
  );

  const handleAccountChanged = useCallback<IHandleAccountChanged>(
    ({ activeAccount, selectedAccount: rawSelectedAccountData }) => {
      setSelectedAccount(activeAccount);
      setRawSelectedAccount(rawSelectedAccountData);
      console.log(
        'connectionmodal setActiveAccount: ',
        activeAccount.account?.id,
      );
    },
    [],
  );

  const subtitle = useMemo(() => {
    if (!selectedAccount?.network?.name) {
      return '';
    }
    return `Allow this site to access your ${selectedAccount?.network?.name} address.`;
  }, [selectedAccount?.network?.name]);

  const confirmDisabled = useMemo(() => {
    if (!canContinueOperate) {
      return true;
    }
    if (!selectedAccount?.account?.address) {
      return true;
    }
    return false;
  }, [selectedAccount, canContinueOperate]);

  const onApproval = useCallback(
    async (close: () => void) => {
      if (!$sourceInfo?.scope) {
        Toast.error({ title: 'no injected scope' });
        return;
      }
      if (!selectedAccount || !selectedAccount.account) {
        Toast.error({ title: 'no account' });
        return;
      }
      const {
        wallet,
        account,
        network,
        indexedAccount,
        deriveType = 'default',
      } = selectedAccount;
      const accountInfo: IConnectionAccountInfo = {
        networkImpl: network?.impl ?? '',
        walletId: wallet?.id ?? '',
        indexedAccountId: indexedAccount?.id ?? '',
        networkId: network?.id ?? '',
        accountId: account.id,
        address: account.address,
        deriveType,

        focusedWallet: rawSelectedAccount?.focusedWallet,
        othersWalletAccountId: rawSelectedAccount?.othersWalletAccountId,
      };
      if (connectType === EConnectionType.ModifyAccount) {
        if (!isNumber(accountSelectorNum)) {
          dappApprove.reject();
          throw new Error('no accountSelectorNum');
        }
        await serviceDApp.updateConnectionSession({
          origin: $sourceInfo?.origin,
          updatedAccountInfo: accountInfo,
          storageType: 'injectedProvider',
          accountSelectorNum,
        });
      } else {
        await serviceDApp.saveConnectionSession({
          origin: $sourceInfo?.origin,
          accountsInfo: [accountInfo],
          storageType: 'injectedProvider',
        });
      }
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
      rawSelectedAccount,
      connectType,
      accountSelectorNum,
    ],
  );

  return (
    <Page scrollEnabled>
      <Page.Header headerShown={false} />
      <Page.Body>
        <DAppRequestLayout
          title="Connection Request"
          subtitle={subtitle}
          origin={$sourceInfo?.origin ?? ''}
          urlSecurityInfo={urlSecurityInfo}
        >
          <DAppAccountListStandAloneItem
            handleAccountChanged={handleAccountChanged}
            onAccountSelectorNumChanged={setAccountSelectorNum}
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
          showContinueOperateCheckbox={
            riskLevel !== EHostSecurityLevel.Security
          }
          riskLevel={riskLevel}
        />
      </Page.Footer>
    </Page>
  );
}

export default ConnectionModal;
