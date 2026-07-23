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
import {
  EParseTxComponentType,
  type IParseMessageResp,
  type ISignatureConfirmDisplay,
} from '@onekeyhq/shared/types/signatureConfirm';

import {
  DAppSiteMark,
  shouldHideDAppSiteRiskStyle,
} from '../../../DAppConnection/components/DAppRequestLayout';
import { useRiskDetection } from '../../../DAppConnection/hooks/useRiskDetection';
import { SecurityCheckCard } from '../../components/SecurityCheckCard';
import { MessageConfirmActions } from '../../components/SignatureConfirmActions';
import { MessageAdvancedSettings } from '../../components/SignatureConfirmAdvanced';
import { MessageDataViewer } from '../../components/SignatureConfirmDataViewer';
import { MessageConfirmDetails } from '../../components/SignatureConfirmDetails';
import { SignatureConfirmLoading } from '../../components/SignatureConfirmLoading';
import { SignatureConfirmProviderMirror } from '../../components/SignatureConfirmProvider/SignatureConfirmProviderMirror';
import SwapInfo from '../../components/SwapInfo';
import { SignatureConfirmTestIDs } from '../../testIDs';

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
  } = useRiskDetection({
    origin: sourceInfo?.origin ?? '',
    unsignedMessage,
    walletConnectVerifyContext: sourceInfo?.walletConnectVerifyContext,
  });

  const { result, isLoading } = usePromiseResult(
    async () => {
      const accountAddress =
        await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
          networkId,
          accountId,
        });

      const resp = await promiseAllSettledEnhanced(
        [
          backgroundApiProxy.serviceSignatureConfirm.parseMessage({
            networkId,
            accountId,
            accountAddress,
            message: unsignedMessage.message,
            swapInfo,
            origin: sourceInfo?.origin,
          }),
        ],
        {
          continueOnError: true,
        },
      );

      const m = resp[0] as unknown as IParseMessageResp;

      let p: ISignatureConfirmDisplay;

      const isMessageParseFallback = !(m && m.display);

      if (!isMessageParseFallback) {
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
        isMessageParseFallback,
      };
    },
    [
      networkId,
      accountId,
      unsignedMessage.message,
      swapInfo,
      sourceInfo?.origin,
    ],
    {
      watchLoading: true,
    },
  );

  const {
    p: parsedMessage,
    isConfirmationRequired,
    isMessageParseFallback,
  } = result ?? {};

  const showMessageHeaderInfo = useMemo(
    () => !walletInternalSign,
    [walletInternalSign],
  );

  const showDAppSiteMark = useMemo(
    () => sourceInfo?.origin && !walletInternalSign,
    [sourceInfo?.origin, walletInternalSign],
  );

  const securityCheckRequestKey = useMemo(
    () =>
      [
        accountId,
        networkId,
        sourceInfo?.origin ?? '',
        unsignedMessage.type,
        unsignedMessage.message,
      ].join('|'),
    [
      accountId,
      networkId,
      sourceInfo?.origin,
      unsignedMessage.message,
      unsignedMessage.type,
    ],
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
            {showDAppSiteMark ? (
              <DAppSiteMark
                origin={sourceInfo?.origin ?? ''}
                urlSecurityInfo={urlSecurityInfo}
                hideRiskStyle={shouldHideDAppSiteRiskStyle(urlSecurityInfo)}
              />
            ) : null}
            <SecurityCheckCard
              kind="message"
              requestKey={securityCheckRequestKey}
              origin={sourceInfo?.origin}
              urlSecurityInfo={urlSecurityInfo}
              messageDisplay={parsedMessage}
              unsignedMessage={unsignedMessage}
              isRiskSignMethod={isRiskSignMethod}
              isConfirmationRequired={isConfirmationRequired}
              isMessageParseFallback={isMessageParseFallback}
            />
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
    sourceInfo?.origin,
    urlSecurityInfo,
    securityCheckRequestKey,
    unsignedMessage,
    isRiskSignMethod,
    showDAppSiteMark,
    accountId,
    networkId,
    swapInfo,
    isConfirmationRequired,
    isMessageParseFallback,
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

  // Pre-warm the device while the user reviews, so Sign can skip Initialize.
  // Fire-and-forget; the service no-ops for non-hardware wallets.
  useEffect(() => {
    if (!accountId) {
      return;
    }
    const walletId = accountUtils.getWalletIdFromAccountId({ accountId });
    void backgroundApiProxy.serviceHardware.preInitializeDeviceForSign({
      walletId,
    });
  }, [accountId]);

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
    <Page
      scrollEnabled
      onClose={handleOnClose}
      safeAreaEnabled
      testID={SignatureConfirmTestIDs.MessageConfirmPage}
    >
      <Page.Header
        title={
          parsedMessage?.title ||
          intl.formatMessage({ id: ETranslations.sig_signature_request_label })
        }
      />
      <Page.Body testID={SignatureConfirmTestIDs.MessageConfirmBody} px="$5">
        {renderMessageConfirmContent()}
      </Page.Body>
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
