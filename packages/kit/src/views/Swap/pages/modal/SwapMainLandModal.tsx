import { useEffect } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { EPageType, Page } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EModalSwapRoutes,
  IModalSwapParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import SwapMainLandWithPageType from '../components/SwapMainLand';

import type { RouteProp } from '@react-navigation/core';

const SwapMainLandModalPage = () => {
  const intl = useIntl();
  const route =
    useRoute<RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapMainLand>>();
  const { importFromToken, importNetworkId, importToToken, swapTabSwitchType } =
    route.params ?? {};
  const [, setSettings] = useSettingsAtom();
  useEffect(() => {
    // when modal swap open, reset swapToAnotherAccountSwitchOn
    setSettings((v) => ({
      ...v,
      swapToAnotherAccountSwitchOn: false,
    }));
  }, [setSettings]);
  return (
    <Page skipLoading={platformEnv.isNativeIOS}>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_swap })}
      />
      <SwapMainLandWithPageType
        pageType={EPageType.modal}
        swapInitParams={{
          importFromToken,
          importNetworkId,
          importToToken,
          swapTabSwitchType,
        }}
      />
    </Page>
  );
};

export default function SwapMainLandModal() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.swap,
      }}
      enabledNum={[0, 1]}
    >
      <SwapMainLandModalPage />
    </AccountSelectorProviderMirror>
  );
}
