import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Page, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EDAppModalPageStatus } from '@onekeyhq/shared/types/dappConnection';
import { EHostSecurityLevel } from '@onekeyhq/shared/types/discovery';

import useDappApproveAction from '../../../hooks/useDappApproveAction';
import useDappQuery from '../../../hooks/useDappQuery';
import {
  DAppRequestFooter,
  DAppRequestLayout,
} from '../components/DAppRequestLayout';

import DappOpenModalPage from './DappOpenModalPage';

function RiskWhiteListModal() {
  const { $sourceInfo, url } = useDappQuery<{
    url: string;
  }>();

  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const intl = useIntl();

  const onSubmit = useCallback(
    async (close?: (extra?: { flag?: string }) => void) => {
      void dappApprove.resolve({
        result: { confirmed: true },
        close: () => {
          close?.({ flag: EDAppModalPageStatus.Confirmed });
        },
      });
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
              id: ETranslations.explore_malicious_dapp_warning_addToWhiteListLink,
            })}
            subtitle={url ?? $sourceInfo?.origin ?? ''}
            origin={$sourceInfo?.origin ?? ''}
          >
            <YStack gap="$2">
              <Alert
                type="critical"
                title={intl.formatMessage({
                  id: ETranslations.explore_malicious_dapp_warning_description,
                })}
              />
            </YStack>
          </DAppRequestLayout>
        </Page.Body>
        <Page.Footer>
          <DAppRequestFooter
            continueOperate
            setContinueOperate={() => {}}
            onConfirm={onSubmit}
            onCancel={() => dappApprove.reject()}
            confirmButtonProps={{
              variant: 'destructive',
            }}
            riskLevel={EHostSecurityLevel.High}
          />
        </Page.Footer>
      </>
    </DappOpenModalPage>
  );
}

export default RiskWhiteListModal;
