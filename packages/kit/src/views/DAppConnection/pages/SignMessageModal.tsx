import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Page, Toast } from '@onekeyhq/components';
import type { IUnsignedMessage } from '@onekeyhq/core/src/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useDappApproveAction from '../../../hooks/useDappApproveAction';
import useDappQuery from '../../../hooks/useDappQuery';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { DAppAccountListStandAloneItem } from '../components/DAppAccountList';
import { DAppSignMessageContent } from '../components/DAppRequestContent';
import {
  DAppRequestFooter,
  DAppRequestLayout,
} from '../components/DAppRequestLayout';
import { useRiskDetection } from '../hooks/useRiskDetection';

function SignMessageModal() {
  const intl = useIntl();
  const { $sourceInfo, unsignedMessage, accountId, networkId } = useDappQuery<{
    unsignedMessage: IUnsignedMessage;
    accountId: string;
    networkId: string;
    indexedAccountId: string;
  }>();

  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const { result: currentNetwork } = usePromiseResult(
    () => backgroundApiProxy.serviceNetwork.getNetwork({ networkId }),
    [networkId],
  );

  const subtitle = useMemo(() => {
    if (!currentNetwork?.name) {
      return '';
    }
    return `Allow this site to request your ${currentNetwork.name} message signature.`;
  }, [currentNetwork]);

  const {
    showContinueOperate,
    continueOperate,
    setContinueOperate,
    riskLevel,
    urlSecurityInfo,
  } = useRiskDetection({ origin: $sourceInfo?.origin ?? '' });

  const handleSignMessage = useCallback(
    async (close: () => void) => {
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
      Toast.success({
        title: intl.formatMessage({
          id: 'msg__success',
        }),
      });
      close?.();
    },
    [unsignedMessage, dappApprove, networkId, accountId, $sourceInfo, intl],
  );

  return (
    <Page
      scrollEnabled
      onClose={(confirmed) => {
        if (!confirmed) {
          dappApprove.reject();
        }
      }}
    >
      <Page.Header headerShown={false} />
      <Page.Body>
        <DAppRequestLayout
          title="Message Signature Request"
          subtitle={subtitle}
          origin={$sourceInfo?.origin ?? ''}
          urlSecurityInfo={urlSecurityInfo}
        >
          <DAppAccountListStandAloneItem readonly />
          <DAppSignMessageContent content={unsignedMessage.message} />
        </DAppRequestLayout>
      </Page.Body>
      <Page.Footer>
        <DAppRequestFooter
          continueOperate={continueOperate}
          setContinueOperate={(checked) => {
            setContinueOperate(!!checked);
          }}
          onConfirm={(params) => handleSignMessage(params)}
          onCancel={() => dappApprove.reject()}
          confirmButtonProps={{
            disabled: !continueOperate,
          }}
          showContinueOperateCheckbox={showContinueOperate}
          riskLevel={riskLevel}
        />
      </Page.Footer>
    </Page>
  );
}

export default SignMessageModal;
