import { useMemo } from 'react';

import { Page, SizableText, Stack } from '@onekeyhq/components';
import { AccountSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import useDappQuery from '../../../hooks/useDappQuery';

function DAppAccountSelector({ origin }: { origin: string }) {
  return (
    // <AccountSelectorProvider
    //   config={{
    //     sceneName: EAccountSelectorSceneName.discover,
    //     sceneUrl: origin,
    //   }}
    //   enabledNum={[0]}
    // >
    // </AccountSelectorProvider>
    <Stack>
      <SizableText>{origin}</SizableText>
      <AccountSelectorTriggerHome
        num={0}
        sceneName={EAccountSelectorSceneName.discover}
        sceneUrl={origin}
      />
    </Stack>
  );
}

function ConnectionModal() {
  const { $sourceInfo } = useDappQuery();
  return (
    <Page>
      <Page.Header title="Connection Modal" />
      <Page.Body>
        {$sourceInfo?.origin ? (
          <AccountSelectorProviderMirror
            config={{
              sceneName: EAccountSelectorSceneName.discover,
              sceneUrl: $sourceInfo.origin,
            }}
            enabledNum={[0]}
          >
            <DAppAccountSelector origin={$sourceInfo.origin} />
          </AccountSelectorProviderMirror>
        ) : null}
      </Page.Body>
    </Page>
  );
}

export default ConnectionModal;
