import { useCallback, useState } from 'react';

import { Checkbox, Page } from '@onekeyhq/components';
import { EDAppModalPageStatus } from '@onekeyhq/shared/types/dappConnection';

import useDappApproveAction from '../../../hooks/useDappApproveAction';
import useDappQuery from '../../../hooks/useDappQuery';
import { DAppRequestLayout } from '../components/DAppRequestLayout';

import DappOpenModalPage from './DappOpenModalPage';

function ClipboardPermissionModal() {
  const { $sourceInfo, clipboardType } = useDappQuery<{
    clipboardType: 'read' | 'write';
  }>();

  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

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
          />
        </Page.Body>
        <Page.Footer>
          <Page.FooterActions
            onConfirm={onConfirm}
            onCancel={() => dappApprove.reject()}
            onConfirmText="Allow"
            cancelButtonProps={{ variant: 'secondary' }}
          >
            <Checkbox
              label="Remember for this site"
              value={remember}
              onChange={(checked) => setRemember(!!checked)}
            />
          </Page.FooterActions>
        </Page.Footer>
      </>
    </DappOpenModalPage>
  );
}

export default ClipboardPermissionModal;
