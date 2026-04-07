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

function ClipboardPermissionModal() {
  const { $sourceInfo, clipboardType } = useDappQuery<{
    clipboardType: 'read' | 'write';
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

  const isRead = clipboardType === 'read';

  const title = isRead
    ? intl.formatMessage({ id: ETranslations.dapp_clipboard_read_title })
    : intl.formatMessage({ id: ETranslations.dapp_clipboard_write_title });

  const subtitle = isRead
    ? intl.formatMessage({ id: ETranslations.dapp_clipboard_read_description })
    : intl.formatMessage({
        id: ETranslations.dapp_clipboard_write_description,
      });

  const onSubmit = useCallback(
    async (close?: (extra?: { flag?: string }) => void) => {
      void dappApprove.resolve({
        result: { allowed: true },
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
            title={title}
            subtitle={subtitle}
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

export default ClipboardPermissionModal;
