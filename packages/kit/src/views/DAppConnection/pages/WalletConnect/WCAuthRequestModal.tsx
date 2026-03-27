import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Page, SizableText, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import useDappQuery from '@onekeyhq/kit/src/hooks/useDappQuery';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import { EDAppModalPageStatus } from '@onekeyhq/shared/types/dappConnection';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

import { DAppAccountListStandAloneItem } from '../../components/DAppAccountList';
import {
  DAppRequestFooter,
  DAppRequestLayout,
} from '../../components/DAppRequestLayout';
import { useRiskDetection } from '../../hooks/useRiskDetection';
import DappOpenModalPage from '../DappOpenModalPage';

import type { IHandleAccountChangedParams } from '../../hooks/useHandleAccountChanged';
import type { WalletKitTypes } from '@reown/walletkit';

function WCAuthRequestModal() {
  const intl = useIntl();
  const [isLoading, setIsLoading] = useState(false);

  const { authRequest, $sourceInfo } = useDappQuery<{
    authRequest: WalletKitTypes.SessionAuthenticate;
  }>();

  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const origin = useMemo(
    () => uriUtils.safeGetWalletConnectAuthOrigin(authRequest) ?? '',
    [authRequest],
  );

  const favicon = useMemo(
    () => authRequest?.params?.requester?.metadata?.icons?.[0],
    [authRequest],
  );

  const {
    showContinueOperate,
    continueOperate,
    setContinueOperate,
    riskLevel,
    urlSecurityInfo,
  } = useRiskDetection({ origin });

  const [activeAccountInfo, setActiveAccountInfo] =
    useState<IHandleAccountChangedParams | null>(null);

  const handleAccountChanged = useCallback(
    (params: IHandleAccountChangedParams) => {
      setActiveAccountInfo(params);
    },
    [],
  );

  const confirmDisabled = useMemo(() => {
    if (!continueOperate) return true;
    if (!activeAccountInfo?.activeAccount?.account?.address) return true;
    return false;
  }, [continueOperate, activeAccountInfo]);

  const siweMessagePreview = useMemo(() => {
    try {
      const domain =
        authRequest?.params?.requester?.metadata?.url ?? 'Unknown';
      const statement =
        authRequest?.params?.authPayload?.statement ??
        'Sign in with Ethereum to the app.';
      return `${domain} wants you to sign in with your Ethereum account.\n\n${statement}`;
    } catch {
      return 'Sign-In with Ethereum request';
    }
  }, [authRequest]);

  const onApproval = useCallback(
    async (close?: (extra?: { flag?: string }) => void) => {
      const { activeAccount } = activeAccountInfo ?? {};
      const account = activeAccount?.account;
      const network = activeAccount?.network;

      if (!account?.address || !account?.id || !network?.id) {
        return;
      }

      setIsLoading(true);
      try {
        const { formatMessage } = await import('@walletconnect/utils');
        const chain =
          authRequest.params.authPayload.chains?.[0] ?? 'eip155:1';
        const iss = `did:pkh:${chain}:${account.address}`;
        const message = formatMessage(authRequest.params.authPayload, iss);

        const signature = await backgroundApiProxy.serviceSend.signMessage({
          unsignedMessage: {
            type: EMessageTypesEth.PERSONAL_SIGN,
            message,
            payload: [message, account.address],
          },
          networkId: network.id,
          accountId: account.id,
        });

        void dappApprove.resolve({
          close: () => {
            close?.({ flag: EDAppModalPageStatus.Confirmed });
          },
          result: {
            address: account.address,
            signature,
            accountId: account.id,
            networkId: network.id,
          },
        });
      } catch (e) {
        console.error('WCAuthRequestModal sign error: ', e);
        dappApprove.reject();
      } finally {
        setIsLoading(false);
      }
    },
    [activeAccountInfo, authRequest, dappApprove],
  );

  return (
    <DappOpenModalPage dappApprove={dappApprove}>
      <>
        <Page.Header headerShown={false} />
        <Page.Body>
          <DAppRequestLayout
            title={intl.formatMessage({
              id: ETranslations.dapp_connect_connection_request,
            })}
            subtitleShown={false}
            origin={origin}
            urlSecurityInfo={urlSecurityInfo}
            favicon={favicon}
          >
            <DAppAccountListStandAloneItem
              readonly
              handleAccountChanged={handleAccountChanged}
            />
            <YStack
              gap="$2"
              p="$3"
              bg="$bgSubdued"
              borderRadius="$3"
              mt="$4"
            >
              <SizableText size="$headingMd" color="$text">
                {intl.formatMessage({
                  id: ETranslations.dapp_connect_message,
                })}
              </SizableText>
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                whiteSpace="pre-wrap"
              >
                {siweMessagePreview}
              </SizableText>
            </YStack>
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
              loading: isLoading,
              disabled: confirmDisabled,
            }}
            showContinueOperateCheckbox={showContinueOperate}
            riskLevel={riskLevel}
          />
        </Page.Footer>
      </>
    </DappOpenModalPage>
  );
}

export default WCAuthRequestModal;
