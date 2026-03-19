import { memo, useCallback, useEffect, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Page, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalSignatureConfirmRoutes,
  IModalSignatureConfirmParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { promiseAllSettledEnhanced } from '@onekeyhq/shared/src/utils/promiseUtils';
import {
  convertAddressToSignatureConfirmAddress,
  convertNetworkToSignatureConfirmNetwork,
} from '@onekeyhq/shared/src/utils/txActionUtils';
import { EDAppModalPageStatus } from '@onekeyhq/shared/types/dappConnection';
import { EHostSecurityLevel } from '@onekeyhq/shared/types/discovery';
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
import { MessageAdvancedSettings } from '../../components/SignatureConfirmAdvanced';
import { MessageConfirmAlert } from '../../components/SignatureConfirmAlert';
import { MessageDataViewer } from '../../components/SignatureConfirmDataViewer';
import { MessageConfirmDetails } from '../../components/SignatureConfirmDetails';
import { SignatureConfirmLoading } from '../../components/SignatureConfirmLoading';
import { SignatureConfirmProviderMirror } from '../../components/SignatureConfirmProvider/SignatureConfirmProviderMirror';
import SwapInfo from '../../components/SwapInfo';

import type { RouteProp } from '@react-navigation/core';

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
  const route =
    useRoute<
      RouteProp<
        IModalSignatureConfirmParamList,
        EModalSignatureConfirmRoutes.MessageConfirm
      >
    >();

  const intl = useIntl();

  const {
    accountId,
    networkId,
    sourceInfo,
    unsignedMessage,
    walletInternalSign,
    skipBackupCheck,
    swapInfo,
    onSuccess,
    onFail,
    onCancel,
  } = route.params;

  const dappApprove = useDappApproveAction({
    id: sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const {
    showContinueOperate,
    continueOperate,
    setContinueOperate,
    urlSecurityInfo,
    isRiskSignMethod,
  } = useRiskDetection({ origin: sourceInfo?.origin ?? '', unsignedMessage });

  const isSignTypedDataV3orV4Method =
    unsignedMessage.type === EMessageTypesEth.TYPED_DATA_V3 ||
    unsignedMessage.type === EMessageTypesEth.TYPED_DATA_V4;

  const typedData = JSON.stringify(unsignedMessage);

  const { result, isLoading } = usePromiseResult(
    async () => {
      const accountAddress =
        await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
          networkId,
          accountId,
        });

      const requests:
        | [Promise<IParseMessageResp | null>, Promise<void>]
        | [Promise<IParseMessageResp | null>] = isSignTypedDataV3orV4Method
        ? [
            backgroundApiProxy.serviceSignatureConfirm.parseMessage({
              networkId,
              accountId,
              accountAddress,
              message: unsignedMessage.message,
              swapInfo,
            }),
            backgroundApiProxy.serviceDiscovery.postSignTypedDataMessage({
              networkId,
              accountId,
              origin: sourceInfo?.origin ?? '',
              typedData,
            }),
          ]
        : [
            backgroundApiProxy.serviceSignatureConfirm.parseMessage({
              networkId,
              accountId,
              accountAddress,
              message: unsignedMessage.message,
              swapInfo,
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
              showAccountName:
                networkUtils.isLightningNetworkByNetworkId(networkId),
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

      return {
        p,
        isConfirmationRequired: m?.isConfirmationRequired,
      };
    },
    [
      networkId,
      accountId,
      isSignTypedDataV3orV4Method,
      unsignedMessage.message,
      swapInfo,
      sourceInfo?.origin,
      typedData,
    ],
    {
      watchLoading: true,
    },
  );

  const { p: parsedMessage, isConfirmationRequired } = result ?? {};

  const showMessageHeaderInfo = useMemo(
    () => !walletInternalSign,
    [walletInternalSign],
  );

  const showDAppRiskyAlert = useMemo(
    () => sourceInfo?.origin && !walletInternalSign,
    [sourceInfo?.origin, walletInternalSign],
  );

  const showMessageAlerts = useMemo(
    () =>
      !walletInternalSign &&
      urlSecurityInfo?.level !== EHostSecurityLevel.Security,
    [walletInternalSign, urlSecurityInfo?.level],
  );

  const showDAppSiteMark = useMemo(
    () => sourceInfo?.origin && !walletInternalSign,
    [sourceInfo?.origin, walletInternalSign],
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
        {showMessageHeaderInfo ? (
          <>
            {showDAppRiskyAlert ? (
              <DAppRiskyAlert
                origin={sourceInfo?.origin ?? ''}
                urlSecurityInfo={urlSecurityInfo}
                hideSecurityAlert
                alertProps={{
                  fullBleed: false,
                  borderTopWidth: 1,
                }}
              />
            ) : null}
            {showMessageAlerts ? (
              <MessageConfirmAlert
                messageDisplay={parsedMessage}
                unsignedMessage={unsignedMessage}
                isRiskSignMethod={isRiskSignMethod}
                showContinueOperateLocal={showContinueOperate}
                urlSecurityInfo={urlSecurityInfo}
                isConfirmationRequired={isConfirmationRequired}
                walletInternalSign={walletInternalSign}
              />
            ) : null}
            {showDAppSiteMark ? (
              <DAppSiteMark
                origin={sourceInfo?.origin ?? ''}
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
        {swapInfo ? <SwapInfo data={swapInfo} /> : null}
        <MessageAdvancedSettings unsignedMessage={unsignedMessage} />
      </YStack>
    );
  }, [
    isLoading,
    parsedMessage,
    showMessageHeaderInfo,
    showDAppRiskyAlert,
    sourceInfo?.origin,
    urlSecurityInfo,
    showMessageAlerts,
    unsignedMessage,
    isRiskSignMethod,
    showDAppSiteMark,
    accountId,
    networkId,
    swapInfo,
    showContinueOperate,
    isConfirmationRequired,
    walletInternalSign,
  ]);

  const handleOnClose = useCallback(
    (extra?: { flag?: string }) => {
      if (extra?.flag !== EDAppModalPageStatus.Confirmed) {
        dappApprove.reject();
      }
    },
    [dappApprove],
  );

  useEffect(() => {
    appEventBus.emit(
      EAppEventBusNames.SignatureConfirmContainerMounted,
      undefined,
    );
  }, []);

  useEffect(() => {
    if (sourceInfo) {
      const walletId = accountUtils.getWalletIdFromAccountId({
        accountId,
      });
      if (!skipBackupCheck) {
        void backgroundApiProxy.serviceAccount.checkIsWalletNotBackedUp({
          walletId,
        });
      }
    }
  }, [sourceInfo, accountId, skipBackupCheck]);

  return (
    <Page scrollEnabled onClose={handleOnClose} safeAreaEnabled>
      <Page.Header
        title={
          parsedMessage?.title ||
          intl.formatMessage({ id: ETranslations.sig_signature_request_label })
        }
      />
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
        isConfirmationRequired={isConfirmationRequired}
        sourceInfo={sourceInfo}
        walletInternalSign={walletInternalSign}
        skipBackupCheck={skipBackupCheck}
        onSuccess={onSuccess}
        onFail={onFail}
        onCancel={onCancel}
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
