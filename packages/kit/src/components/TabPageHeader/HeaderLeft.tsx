import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { NavBackButton, Page } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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
  const intl = useIntl();
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
          visible: true,
          content: intl.formatMessage({
            id: ETranslations.spotlight_account_alignment_desc,
          }),
          onConfirm: () => {
            console.log('Done');
          },
          childrenPaddingVertical: 0,
          tourName: ESpotlightTour.switchDappAccount,
        }}
      />
    );
    return accountSelectorTrigger;
  }, [intl, sceneName]);
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
