import { useCallback, useState } from 'react';

import { Page, SizableText, Stack } from '@onekeyhq/components';
import type { IUnsignedMessage } from '@onekeyhq/core/src/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useDappApproveAction from '../../../hooks/useDappApproveAction';
import useDappQuery from '../../../hooks/useDappQuery';
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
  }>();

  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const handleSignMessage = useCallback(async () => {
    const result = await backgroundApiProxy.serviceDApp.signMessage({
      unsignedMessage,
      networkId,
      accountId,
    });
    void dappApprove.resolve({
      result,
    });
  }, [unsignedMessage, dappApprove, networkId, accountId]);

  return (
    <Page>
      <Page.Header title="WalletConnect Sessions" />
      <Page.Body>
        <Stack>
          <SizableText>Sign Message: {unsignedMessage.message}</SizableText>
        </Stack>
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
