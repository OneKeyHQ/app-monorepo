import { useCallback, useState } from 'react';

import { Checkbox, Page, Stack } from '@onekeyhq/components';
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

  const [remember, setRemember] = useState(false);

  const isRead = clipboardType === 'read';

  const title = isRead ? 'Read Clipboard' : 'Write to Clipboard';

  const subtitle = isRead
    ? 'This site wants to read your clipboard content'
    : 'This site wants to write to your clipboard';

  const onConfirm = useCallback(
    async (close?: (extra?: { flag?: string }) => void) => {
      void dappApprove.resolve({
        result: { allowed: true, remember },
        close: () => {
          close?.({ flag: EDAppModalPageStatus.Confirmed });
        },
      });
    },
    [dappApprove, remember],
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
          >
            <Stack px="$5">
              <Checkbox
                label="Remember for this site"
                value={remember}
                onChange={(checked) => setRemember(!!checked)}
              />
            </Stack>
          </DAppRequestLayout>
        </Page.Body>
        <Page.Footer>
          <DAppRequestFooter
            continueOperate={continueOperate}
            setContinueOperate={(checked) => {
              setContinueOperate(!!checked);
            }}
            onConfirm={onConfirm}
            onCancel={() => dappApprove.reject()}
            confirmButtonProps={{
              disabled: showContinueOperate ? !continueOperate : false,
            }}
            showContinueOperateCheckbox={showContinueOperate}
            riskLevel={riskLevel}
            confirmText="Allow"
          />
        </Page.Footer>
      </>
    </DappOpenModalPage>
  );
}

export default ClipboardPermissionModal;
