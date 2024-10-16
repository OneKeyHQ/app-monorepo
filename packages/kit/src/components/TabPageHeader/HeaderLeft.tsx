import { useMemo } from 'react';

import { NavBackButton, Page } from '@onekeyhq/components';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  AccountSelectorProviderMirror,
  AccountSelectorTriggerHome,
} from '../AccountSelector';

export function HeaderLeft({
  sceneName,
}: {
  sceneName: EAccountSelectorSceneName;
}) {
  const items = useMemo(() => {
    if (sceneName === EAccountSelectorSceneName.homeUrlAccount) {
      return (
        <Page.Close>
          <NavBackButton />
        </Page.Close>
      );
    }

    const accountSelectorTrigger = (
      <AccountSelectorTriggerHome
        num={0}
        key="accountSelectorTrigger"
        spotlightProps={{
          delayMs: 300,
          isVisible: true,
          message: 'abcdefg',
          childrenPaddingVertical: 0,
          tourName: ESpotlightTour.switchDappAccount,
        }}
      />
    );
    return accountSelectorTrigger;
  }, [sceneName]);
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName,
        sceneUrl: '',
      }}
    >
      {items}
    </AccountSelectorProviderMirror>
  );
}
