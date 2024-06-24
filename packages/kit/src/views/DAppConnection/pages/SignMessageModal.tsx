import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EDAppModalPageStatus } from '@onekeyhq/shared/types/dappConnection';
import { EHostSecurityLevel } from '@onekeyhq/shared/types/discovery';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useDappApproveAction from '../../../hooks/useDappApproveAction';
import useDappQuery from '../../../hooks/useDappQuery';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import {
  DAppAccountListStandAloneItem,
  DAppAccountListStandAloneItemForHomeScene,
} from '../components/DAppAccountList';
import { DAppSignMessageContent } from '../components/DAppRequestContent';
import {
  DAppRequestFooter,
  DAppRequestLayout,
} from '../components/DAppRequestLayout';
import { useRiskDetection } from '../hooks/useRiskDetection';

import DappOpenModalPage from './DappOpenModalPage';

function SignMessageModal() {
  const intl = useIntl();
  const [isLoading, setIsLoading] = useState(false);
  const { $sourceInfo, unsignedMessage, accountId, networkId, sceneName } =
    useDappQuery<{
      unsignedMessage: IUnsignedMessage;
      accountId: string;
      networkId: string;
      indexedAccountId: string;
      sceneName: EAccountSelectorSceneName;
    }>();

  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const { result: currentNetwork } = usePromiseResult(
    () => backgroundApiProxy.serviceNetwork.getNetwork({ networkId }),
    [networkId],
  );

  const isRiskSignMethod = unsignedMessage.type === EMessageTypesEth.ETH_SIGN;

  const subtitle = useMemo(() => {
    if (!currentNetwork?.name) {
      return '';
    }
    return intl.formatMessage(
      {
        id: ETranslations.dapp_connect_allow_to_access_your_chain_message_signature,
      },
      { chain: currentNetwork.name },
    );
  }, [intl, currentNetwork]);

  const {
    showContinueOperate,
    continueOperate,
    setContinueOperate,
    riskLevel,
    urlSecurityInfo,
  } = useRiskDetection({ origin: $sourceInfo?.origin ?? '', isRiskSignMethod });

  const handleSignMessage = useCallback(
    async (close?: (extra?: { flag?: string }) => void) => {
      setIsLoading(true);
      try {
        const result = await backgroundApiProxy.serviceSend.signMessage({
          unsignedMessage,
          networkId,
          accountId,
        });
        void dappApprove.resolve({
          result,
        });
        await backgroundApiProxy.serviceSignature.addItemFromSignMessage({
          networkId,
          accountId,
          message: unsignedMessage.message,
          sourceInfo: $sourceInfo,
        });
        close?.({ flag: EDAppModalPageStatus.Confirmed });
      } finally {
        setIsLoading(false);
      }
    },
    [unsignedMessage, dappApprove, networkId, accountId, $sourceInfo],
  );

  return (
    <DappOpenModalPage dappApprove={dappApprove}>
      <>
        <Page.Header headerShown={false} />
        <Page.Body>
          <DAppRequestLayout
            title={intl.formatMessage({
              id: ETranslations.dapp_connect_initiate_message_signature_request,
            })}
            subtitle={subtitle}
            origin={$sourceInfo?.origin ?? ''}
            urlSecurityInfo={urlSecurityInfo}
            isRiskSignMethod={isRiskSignMethod}
          >
            {sceneName === EAccountSelectorSceneName.home ? (
              <DAppAccountListStandAloneItemForHomeScene />
            ) : (
              <DAppAccountListStandAloneItem readonly />
            )}
            <DAppSignMessageContent unsignedMessage={unsignedMessage} />
          </DAppRequestLayout>
        </Page.Body>
        <Page.Footer>
          <DAppRequestFooter
            confirmText={intl.formatMessage({
              id: ETranslations.dapp_connect_confirm,
            })}
            continueOperate={continueOperate}
            setContinueOperate={(checked) => {
              setContinueOperate(!!checked);
            }}
            onConfirm={(params) => handleSignMessage(params)}
            onCancel={() => dappApprove.reject()}
            confirmButtonProps={{
              loading: isLoading,
              disabled: !continueOperate,
            }}
            showContinueOperateCheckbox={showContinueOperate}
            riskLevel={isRiskSignMethod ? EHostSecurityLevel.High : riskLevel}
          />
        </Page.Footer>
      </>
    </DappOpenModalPage>
  );
}

export default SignMessageModal;
