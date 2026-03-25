import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EDAppModalPageStatus } from '@onekeyhq/shared/types/dappConnection';

import useDappApproveAction from '../../../hooks/useDappApproveAction';
import useDappQuery from '../../../hooks/useDappQuery';
import {
  DAppRequestFooter,
  DAppRequestLayout,
} from '../components/DAppRequestLayout';
import { useRiskDetection } from '../hooks/useRiskDetection';

import DappOpenModalPage from './DappOpenModalPage';

function RiskWhiteListModal() {
  const { $sourceInfo } = useDappQuery<{
    url: string;
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
            subtitle={intl.formatMessage({
              id: ETranslations.explore_malicious_dapp_warning_description,
            })}
            origin={$sourceInfo?.origin ?? ''}
            urlSecurityInfo={urlSecurityInfo}
          />
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

export default RiskWhiteListModal;
