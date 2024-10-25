import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IAlertProps } from '@onekeyhq/components';
import {
  Divider,
  Page,
  SizableText,
  YGroup,
  YStack,
} from '@onekeyhq/components';
import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import { NetworkSelectorTriggerDappConnectionCmp } from '@onekeyhq/kit/src/components/AccountSelector';
import { AccountSelectorTriggerDappConnectionCmp } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorTrigger/AccountSelectorTriggerDApp';
import type { IDBIndexedAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  isPrimaryTypeOrderSign,
  isPrimaryTypePermitSign,
} from '@onekeyhq/shared/src/signMessage';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  validateSignMessageData,
  validateTypedSignMessageDataV1,
  validateTypedSignMessageDataV3V4,
} from '@onekeyhq/shared/src/utils/messageUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EDAppModalPageStatus } from '@onekeyhq/shared/types/dappConnection';
import { EHostSecurityLevel } from '@onekeyhq/shared/types/discovery';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

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

import DappOpenModalPage from './DappOpenModalPage';

const WalletAccountListItem = ({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
}) => {
  const intl = useIntl();
  const { result, isLoading } = usePromiseResult(async () => {
    const [network, account, wallet] = await Promise.all([
      backgroundApiProxy.serviceNetwork.getNetworkSafe({
        networkId,
      }),
      backgroundApiProxy.serviceAccount.getAccount({
        accountId,
        networkId,
      }),
      backgroundApiProxy.serviceAccount.getWallet({
        walletId: accountUtils.getWalletIdFromAccountId({ accountId }),
      }),
    ]);
    let indexedAccount: IDBIndexedAccount | undefined;
    if (account.indexedAccountId) {
      indexedAccount =
        await backgroundApiProxy.serviceAccount.getIndexedAccount({
          id: account.indexedAccountId,
        });
    }

    return { network, account, wallet, indexedAccount };
  }, [networkId, accountId]);
  return (
    <YStack gap="$2">
      <SizableText size="$headingMd" color="$text">
        {intl.formatMessage({ id: ETranslations.global_accounts })}
      </SizableText>
      <YGroup
        bg="$bg"
        borderRadius="$3"
        borderColor="$borderSubdued"
        borderWidth={StyleSheet.hairlineWidth}
        separator={<Divider />}
        disabled
        overflow="hidden"
      >
        <YGroup.Item>
          <NetworkSelectorTriggerDappConnectionCmp
            isLoading={isLoading}
            network={result?.network}
            triggerDisabled
          />
        </YGroup.Item>
        <YGroup.Item>
          <AccountSelectorTriggerDappConnectionCmp
            isLoading={isLoading}
            account={result?.account}
            wallet={result?.wallet}
            indexedAccount={result?.indexedAccount}
            triggerDisabled
          />
        </YGroup.Item>
      </YGroup>
    </YStack>
  );
};

function SignMessageModal() {
  const intl = useIntl();
  const [isLoading, setIsLoading] = useState(false);
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

  const { result: currentNetwork } = usePromiseResult(
    () => backgroundApiProxy.serviceNetwork.getNetwork({ networkId }),
    [networkId],
  );

  const isPermitSignMethod = isPrimaryTypePermitSign({ unsignedMessage });
  const isOrderSignMethod = isPrimaryTypeOrderSign({ unsignedMessage });
  const isSignTypedDataV3orV4Method =
    unsignedMessage.type === EMessageTypesEth.TYPED_DATA_V3 ||
    unsignedMessage.type === EMessageTypesEth.TYPED_DATA_V4;

  useEffect(() => {
    if (isSignTypedDataV3orV4Method) {
      void backgroundApiProxy.serviceDiscovery.postSignTypedDataMessage({
        networkId,
        accountId,
        origin: $sourceInfo?.origin ?? '',
        typedData: unsignedMessage.message,
      });
    }
  }, [
    isSignTypedDataV3orV4Method,
    $sourceInfo?.origin,
    accountId,
    networkId,
    unsignedMessage.message,
  ]);

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
    isRiskSignMethod,
  } = useRiskDetection({ origin: $sourceInfo?.origin ?? '', unsignedMessage });

  const handleSignMessage = useCallback(
    async (close?: (extra?: { flag?: string }) => void) => {
      setIsLoading(true);

      try {
        if (
          unsignedMessage.type === EMessageTypesEth.ETH_SIGN ||
          unsignedMessage.type === EMessageTypesEth.PERSONAL_SIGN
        ) {
          validateSignMessageData(unsignedMessage, currentNetwork?.impl);
        }
        if (unsignedMessage.type === EMessageTypesEth.TYPED_DATA_V1) {
          validateTypedSignMessageDataV1(unsignedMessage, currentNetwork?.impl);
        }
        if (
          unsignedMessage.type === EMessageTypesEth.TYPED_DATA_V3 ||
          unsignedMessage.type === EMessageTypesEth.TYPED_DATA_V4
        ) {
          validateTypedSignMessageDataV3V4(
            unsignedMessage,
            networkUtils.getNetworkChainId({ networkId }),
            currentNetwork?.impl,
          );
        }
      } catch (e: any) {
        setIsLoading(false);
        dappApprove?.reject({ error: e });
        close?.();
        return;
      }

      try {
        const result = await backgroundApiProxy.serviceSend.signMessage({
          unsignedMessage,
          networkId,
          accountId,
        });
        void dappApprove.resolve({
          result,
        });
        try {
          await backgroundApiProxy.serviceSignature.addItemFromSignMessage({
            networkId,
            accountId,
            message: unsignedMessage.message,
            sourceInfo: $sourceInfo,
          });
        } catch {
          // noop
        }
        close?.({ flag: EDAppModalPageStatus.Confirmed });
      } finally {
        setIsLoading(false);
      }
    },
    [
      unsignedMessage,
      currentNetwork?.impl,
      networkId,
      dappApprove,
      accountId,
      $sourceInfo,
    ],
  );

  const getSignMessageAlertProps = (): IAlertProps | undefined => {
    if (!isSignTypedDataV3orV4Method) {
      return undefined;
    }

    let type: IAlertProps['type'] = 'default';
    let messageType = 'signTypedData';

    if (isPermitSignMethod || isOrderSignMethod) {
      type = 'warning';
      messageType = isPermitSignMethod ? 'permit' : 'order';
    }

    return {
      type,
      icon: 'InfoSquareSolid',
      title: intl.formatMessage(
        {
          id: ETranslations.dapp_connect_permit_sign_alert,
        },
        { type: messageType },
      ),
    };
  };

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
            displaySignMessageAlert={
              isRiskSignMethod || isSignTypedDataV3orV4Method
            }
            signMessageAlertProps={getSignMessageAlertProps()}
            fullScreen={!platformEnv.isNativeIOS}
          >
            {walletInternalSign ? (
              <WalletAccountListItem
                accountId={accountId}
                networkId={networkId}
              />
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
