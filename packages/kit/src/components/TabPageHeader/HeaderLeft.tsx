import { useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { NavBackButton, Page, SizableText } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import useListenTabFocusState from '../../hooks/useListenTabFocusState';
import {
  AccountSelectorProviderMirror,
  AccountSelectorTriggerHome,
} from '../AccountSelector';
import { useSpotlight } from '../Spotlight';

export function HeaderLeft({
  sceneName,
}: {
  sceneName: EAccountSelectorSceneName;
}) {
  const intl = useIntl();
  const { tourTimes, tourVisited } = useSpotlight(
    ESpotlightTour.switchDappAccount,
  );

  const [isFocus, setIsFocus] = useState(false);

  useListenTabFocusState(
    ETabRoutes.Home,
    async (focus: boolean, hideByModal: boolean) => {
      setIsFocus(!hideByModal && focus);
    },
  );
  const spotlightVisible = useMemo(
    () => tourTimes === 1 && isFocus,
    [isFocus, tourTimes],
  );
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
          visible: spotlightVisible,
          content: (
            <SizableText size="$bodyMd">
              {intl.formatMessage({
                id: ETranslations.spotlight_account_alignment_desc,
              })}
            </SizableText>
          ),
          onConfirm: () => {
            void tourVisited(2);
          },
          childrenPaddingVertical: 0,
        }}
      />
    );
    return accountSelectorTrigger;
  }, [intl, sceneName, spotlightVisible, tourVisited]);
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
