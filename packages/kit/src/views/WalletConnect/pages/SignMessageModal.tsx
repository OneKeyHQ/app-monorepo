import { useCallback, useEffect } from 'react';

import { Page, SizableText, Stack } from '@onekeyhq/components';
import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import { AccountSelectorProvider } from '@onekeyhq/kit/src/components/AccountSelector';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useDappApproveAction from '../../../hooks/useDappApproveAction';
import useDappQuery from '../../../hooks/useDappQuery';
import {
  useAccountSelectorActions,
  useActiveAccount,
} from '../../../states/jotai/contexts/accountSelector';

function SignMessageModal() {
  const { $sourceInfo, unsignedMessage } = useDappQuery<{
    unsignedMessage: IUnsignedMessage;
  }>();

  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const actions = useAccountSelectorActions();
  const { activeAccount } = useActiveAccount({ num: 0 });
  useEffect(() => {
    void actions.current.initFromStorage({
      sceneName: EAccountSelectorSceneName.discover,
      sceneUrl: $sourceInfo?.origin,
      num: 0,
    });
  }, [activeAccount, actions, $sourceInfo?.origin]);

  const handleSignMessage = useCallback(async () => {
    const result = await backgroundApiProxy.serviceDApp.signMessage({
      unsignedMessage,
      networkId: activeAccount.network?.id ?? '',
      accountId: activeAccount.account?.id ?? '',
    });
    void dappApprove.resolve({
      result,
    });
  }, [activeAccount, unsignedMessage, dappApprove]);

  return (
    <Page>
      <Page.Header title="WalletConnect Sessions" />
      <Page.Body>
        <Stack>
          <SizableText>Sign Message: {unsignedMessage.message}</SizableText>
        </Stack>
      </Page.Body>
      <Page.Footer
        onConfirmText="Sign"
        onCancelText="Cancel"
        onConfirm={handleSignMessage}
        onCancel={() => {
          dappApprove.reject();
        }}
      />
    </Page>
  );
}

function SignMessageModalProvider() {
  const { $sourceInfo } = useDappQuery();
  return (
    <AccountSelectorProvider
      config={{
        sceneName: EAccountSelectorSceneName.discover,
        sceneUrl: $sourceInfo?.origin,
      }}
      enabledNum={[0]}
    >
      <SignMessageModal />
    </AccountSelectorProvider>
  );
}

export default SignMessageModalProvider;
