import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Page, SizableText, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EDAppModalPageStatus } from '@onekeyhq/shared/types/dappConnection';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useDappApproveAction from '../../../hooks/useDappApproveAction';
import useDappQuery from '../../../hooks/useDappQuery';
import { DAppAccountListStandAloneItem } from '../components/DAppAccountList';
import {
  DAppRequestFooter,
  DAppRequestLayout,
} from '../components/DAppRequestLayout';
import { useRiskDetection } from '../hooks/useRiskDetection';

import DappOpenModalPage from './DappOpenModalPage';

function CosmosEnigmaUnlockModal() {
  const { $sourceInfo } = useDappQuery<{
    walletId: string;
    accountId: string;
    networkId: string;
  }>();

  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const {
    showContinueOperate,
    continueOperate,
    setContinueOperate,
    riskLevel,
    urlSecurityInfo,
  } = useRiskDetection({ origin: $sourceInfo?.origin ?? '' });

  const intl = useIntl();
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = useCallback(
    async (close?: (extra?: { flag?: string }) => void) => {
      try {
        setIsLoading(true);
        const { servicePassword } = backgroundApiProxy;

        const { password } = await servicePassword.promptPasswordVerify();

        void dappApprove.resolve({
          result: { password },
          close: () => {
            close?.({ flag: EDAppModalPageStatus.Confirmed });
          },
        });
      } catch (_e) {
        dappApprove.reject();
      } finally {
        setIsLoading(false);
      }
    },
    [dappApprove],
  );

  return (
    <DappOpenModalPage dappApprove={dappApprove}>
      <>
        <Page.Header headerShown={false} />
        <Page.Body>
          <DAppRequestLayout
            title={intl.formatMessage({
              id: ETranslations.dapp_connect_encrypted_request,
            })}
            subtitle={intl.formatMessage(
              {
                id: ETranslations.dapp_connect_allow_to_access_your_chain_encrypted_message,
              },
              {
                chain: 'Secret Network',
              },
            )}
            origin={$sourceInfo?.origin ?? ''}
            urlSecurityInfo={urlSecurityInfo}
          >
            <DAppAccountListStandAloneItem readonly />
            <YStack gap="$2">
              <SizableText size="$bodyLg" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.dapp_connect_cosmos_requires_wallet_unlock_secret_enigma_utils,
                })}
              </SizableText>
            </YStack>
          </DAppRequestLayout>
        </Page.Body>
        <Page.Footer>
          <DAppRequestFooter
            continueOperate={continueOperate}
            setContinueOperate={(checked) => {
              setContinueOperate(!!checked);
            }}
            onConfirm={onSubmit}
            onCancel={() => dappApprove.reject()}
            confirmButtonProps={{
              loading: isLoading,
              disabled: !continueOperate,
            }}
            showContinueOperateCheckbox={showContinueOperate}
            riskLevel={riskLevel}
          />
        </Page.Footer>
      </>
    </DappOpenModalPage>
  );
}

export default CosmosEnigmaUnlockModal;
