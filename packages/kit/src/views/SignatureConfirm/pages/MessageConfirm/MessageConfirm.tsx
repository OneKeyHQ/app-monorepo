import { memo, useCallback } from 'react';

import { Page, YStack } from '@onekeyhq/components';
import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import useDappQuery from '@onekeyhq/kit/src/hooks/useDappQuery';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { promiseAllSettledEnhanced } from '@onekeyhq/shared/src/utils/promiseUtils';
import {
  convertAddressToSignatureConfirmAddress,
  convertNetworkToSignatureConfirmNetwork,
} from '@onekeyhq/shared/src/utils/txActionUtils';
import { EDAppModalPageStatus } from '@onekeyhq/shared/types/dappConnection';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import {
  EParseTxComponentType,
  type IParseMessageResp,
  type ISignatureConfirmDisplay,
} from '@onekeyhq/shared/types/signatureConfirm';

import {
  DAppRiskyAlert,
  DAppSiteMark,
} from '../../../DAppConnection/components/DAppRequestLayout';
import { useRiskDetection } from '../../../DAppConnection/hooks/useRiskDetection';
import { MessageConfirmActions } from '../../components/SignatureConfirmActions';
import { MessageConfirmAlert } from '../../components/SignatureConfirmAlert';
import { MessageDataViewer } from '../../components/SignatureConfirmDataViewer';
import { MessageConfirmDetails } from '../../components/SignatureConfirmDetails';
import { SignatureConfirmLoading } from '../../components/SignatureConfirmLoading';
import { SignatureConfirmProviderMirror } from '../../components/SignatureConfirmProvider/SignatureConfirmProviderMirror';

export function useDappCloseHandler(
  dappApprove: ReturnType<typeof useDappApproveAction>,
  onClose?: (extra?: { flag?: string }) => void,
) {
  const handleOnClose = (extra?: { flag?: string }) => {
    if (extra?.flag !== EDAppModalPageStatus.Confirmed) {
      dappApprove.reject();
    }
    if (typeof onClose === 'function') {
      onClose(extra);
    }
  };

  return handleOnClose;
}

function MessageConfirm() {
  const {
    $sourceInfo,
    unsignedMessage,
    accountId,
    networkId,
    walletInternalSign,
  } = useDappQuery<{
    unsignedMessage: IUnsignedMessage;
    accountId: string;
    networkId: string;
    indexedAccountId: string;
    walletInternalSign?: boolean;
  }>();

  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const {
    showContinueOperate,
    continueOperate,
    setContinueOperate,
    urlSecurityInfo,
    isRiskSignMethod,
  } = useRiskDetection({ origin: $sourceInfo?.origin ?? '', unsignedMessage });

  const isSignTypedDataV3orV4Method =
    unsignedMessage.type === EMessageTypesEth.TYPED_DATA_V3 ||
    unsignedMessage.type === EMessageTypesEth.TYPED_DATA_V4;

  const typedData = JSON.stringify(unsignedMessage);

  const { result: parsedMessage, isLoading } = usePromiseResult(
    async () => {
      const accountAddress =
        await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
          networkId,
          accountId,
        });

      const requests:
        | [Promise<IParseMessageResp>, Promise<void>]
        | [Promise<IParseMessageResp>] = isSignTypedDataV3orV4Method
        ? [
            backgroundApiProxy.serviceSignatureConfirm.parseMessage({
              networkId,
              accountId,
              accountAddress,
              message: unsignedMessage.message,
            }),
            backgroundApiProxy.serviceDiscovery.postSignTypedDataMessage({
              networkId,
              accountId,
              origin: $sourceInfo?.origin ?? '',
              typedData,
            }),
          ]
        : [
            backgroundApiProxy.serviceSignatureConfirm.parseMessage({
              networkId,
              accountId,
              accountAddress,
              message: unsignedMessage.message,
            }),
          ];

      const resp = await promiseAllSettledEnhanced(
        // @ts-ignore
        requests,
        {
          continueOnError: true,
        },
      );

      const m = resp[0] as unknown as IParseMessageResp;

      let p: ISignatureConfirmDisplay;

      if (m && m.display) {
        p = m.display;
      } else {
        p = {
          title: '',
          components: [
            convertNetworkToSignatureConfirmNetwork({
              networkId,
            }),
            convertAddressToSignatureConfirmAddress({
              address: accountAddress,
            }),
            {
              type: EParseTxComponentType.Divider,
            },
          ],
          alerts: [],
        };
      }

      if (
        p.components[p.components.length - 1].type !==
        EParseTxComponentType.Divider
      ) {
        p.components.push({
          type: EParseTxComponentType.Divider,
        });
      }

      return p;
    },
    [
      networkId,
      accountId,
      isSignTypedDataV3orV4Method,
      unsignedMessage.message,
      $sourceInfo?.origin,
      typedData,
    ],
    {
      watchLoading: true,
    },
  );

  const renderMessageConfirmContent = useCallback(() => {
    if (isLoading) {
      return <SignatureConfirmLoading />;
    }

    if (!parsedMessage) {
      return null;
    }

    return (
      <YStack gap="$5">
        {!walletInternalSign ? (
          <>
            {$sourceInfo?.origin ? (
              <DAppRiskyAlert
                origin={$sourceInfo.origin}
                urlSecurityInfo={urlSecurityInfo}
                alertProps={{
                  fullBleed: false,
                  borderTopWidth: 1,
                }}
              />
            ) : null}
            {!walletInternalSign ? (
              <MessageConfirmAlert
                messageDisplay={parsedMessage}
                unsignedMessage={unsignedMessage}
                isRiskSignMethod={isRiskSignMethod}
              />
            ) : null}
            {$sourceInfo?.origin && !walletInternalSign ? (
              <DAppSiteMark
                origin={$sourceInfo.origin}
                urlSecurityInfo={urlSecurityInfo}
              />
            ) : null}
          </>
        ) : null}

        <MessageConfirmDetails
          accountId={accountId}
          networkId={networkId}
          displayComponents={parsedMessage.components}
        />
        <MessageDataViewer unsignedMessage={unsignedMessage} />
      </YStack>
    );
  }, [
    isLoading,
    parsedMessage,
    walletInternalSign,
    $sourceInfo?.origin,
    urlSecurityInfo,
    unsignedMessage,
    isRiskSignMethod,
    accountId,
    networkId,
  ]);

  const handleOnClose = useCallback(
    (extra?: { flag?: string }) => {
      if (extra?.flag !== EDAppModalPageStatus.Confirmed) {
        dappApprove.reject();
      }
    },
    [dappApprove],
  );

  return (
    <Page scrollEnabled onClose={handleOnClose} safeAreaEnabled>
      <Page.Header title={parsedMessage?.title} />
      <Page.Body px="$5">{renderMessageConfirmContent()}</Page.Body>
      <MessageConfirmActions
        accountId={accountId}
        networkId={networkId}
        unsignedMessage={unsignedMessage}
        messageDisplay={parsedMessage}
        showContinueOperate={showContinueOperate}
        continueOperate={continueOperate}
        setContinueOperate={setContinueOperate}
        urlSecurityInfo={urlSecurityInfo}
      />
    </Page>
  );
}

const MessageConfirmWithProvider = memo(() => (
  <SignatureConfirmProviderMirror>
    <MessageConfirm />
  </SignatureConfirmProviderMirror>
));
MessageConfirmWithProvider.displayName = 'MessageConfirmWithProvider';

export default MessageConfirmWithProvider;
