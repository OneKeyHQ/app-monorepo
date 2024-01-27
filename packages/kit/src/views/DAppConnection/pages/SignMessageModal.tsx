import { useCallback, useState } from 'react';

import { Page, SizableText, Stack } from '@onekeyhq/components';
import type { IUnsignedMessage } from '@onekeyhq/core/src/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useDappApproveAction from '../../../hooks/useDappApproveAction';
import useDappQuery from '../../../hooks/useDappQuery';
import { DAppAccountListStandAloneItem } from '../components/DAppAccountList';
import { DAppSignMessageContent } from '../components/DAppRequestContent';
import {
  DAppRequestFooter,
  DAppRequestLayout,
} from '../components/DAppRequestLayout';

function SignMessageModal() {
  const [continueOperate, setContinueOperate] = useState(false);
  const { $sourceInfo, unsignedMessage, accountId, networkId } = useDappQuery<{
    unsignedMessage: IUnsignedMessage;
    accountId: string;
    networkId: string;
    indexedAccountId: string;
  }>();

  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const handleSignMessage = useCallback(
    async ({ close }: { close?: () => void }) => {
      const result = await backgroundApiProxy.serviceDApp.signMessage({
        unsignedMessage,
        networkId,
        accountId,
      });
      void dappApprove.resolve({
        result,
      });
      close?.();
    },
    [unsignedMessage, dappApprove, networkId, accountId],
  );

  return (
    <Page>
      <Page.Header headerShown={false} />
      <Page.Body>
        <DAppRequestLayout title="Message Signature Request">
          <DAppAccountListStandAloneItem readonly />
          <DAppSignMessageContent content={unsignedMessage.message} />
        </DAppRequestLayout>
      </Page.Body>
      <Page.Footer>
        <DAppRequestFooter
          continueOperate={continueOperate}
          setContinueOperate={(checked) => {
            setContinueOperate(!!checked);
          }}
          onConfirm={handleSignMessage}
          onCancel={() => dappApprove.reject()}
        />
      </Page.Footer>
    </Page>
  );
}

export default SignMessageModal;
