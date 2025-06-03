import { useMemo } from 'react';

import { XStack, useIsHorizontalLayout } from '@onekeyhq/components';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { UrlAccountNavHeader } from '../../views/Home/pages/urlAccount/UrlAccountNavHeader';
import {
  AccountSelectorProviderMirror,
  NetworkSelectorTriggerHome,
} from '../AccountSelector';

export function HeaderTitle({
  sceneName,
}: {
  sceneName: EAccountSelectorSceneName;
}) {
  const isHorizontal = useIsHorizontalLayout();

  const item = useMemo(() => {
    if (sceneName === EAccountSelectorSceneName.homeUrlAccount) {
      return (
        <XStack gap="$2.5" ai="center">
          <UrlAccountNavHeader.Address key="urlAccountNavHeaderAddress" />
          {isHorizontal ? (
            <NetworkSelectorTriggerHome
              num={0}
              recordNetworkHistoryEnabled
              hideOnNoAccount
            />
          ) : null}
        </XStack>
      );
    }
  }, [isHorizontal, sceneName]);
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName,
        sceneUrl: '',
      }}
    >
      {item}
    </AccountSelectorProviderMirror>
  );
}
