import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';

import { EModalSettingRoutes } from './types';

import type { IModalSettingParamList } from './types';

const SettingAccountDerivationModal = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Setting/pages/AccountDerivation'),
);

const SettingAppLockModal = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Setting/pages/AppLock'),
);

const SettingCurrencyModal = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Setting/pages/Currency'),
);
const SettingHardwareSdkUrlModal = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Setting/pages/HardwareSdkUrl'),
);
const SettingListModal = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Setting/pages/List'),
);
const SettingProtectionModal = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Setting/pages/Protection'),
);
const SettingSpendUTXOModal = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Setting/pages/SpendUTXO'),
);
const SettingThemeModal = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Setting/pages/Theme'),
);
const SettingLanguageModal = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Setting/pages/Language'),
);
export const ModalSettingStack: IModalFlowNavigatorConfig<
  EModalSettingRoutes,
  IModalSettingParamList
>[] = [
  {
    name: EModalSettingRoutes.SettingListModal,
    component: SettingListModal,
    translationId: 'title__settings',
  },
  {
    name: EModalSettingRoutes.SettingCurrencyModal,
    component: SettingCurrencyModal,
    translationId: 'content__currency',
  },
  {
    name: EModalSettingRoutes.SettingLanguageModal,
    component: SettingLanguageModal,
    translationId: 'form__language',
  },
  {
    name: EModalSettingRoutes.SettingThemeModal,
    component: SettingThemeModal,
    translationId: 'form__theme',
  },
  {
    name: EModalSettingRoutes.SettingSpendUTXOModal,
    component: SettingSpendUTXOModal,
    translationId: 'form__spend_dust_utxo',
  },
  {
    name: EModalSettingRoutes.SettingAccountDerivationModal,
    component: SettingAccountDerivationModal,
    translationId: 'form__theme',
  },
  {
    name: EModalSettingRoutes.SettingHardwareSdkUrlModal,
    component: SettingHardwareSdkUrlModal,
    translationId: 'form__hardware_bridge_sdk_url',
  },
  {
    name: EModalSettingRoutes.SettingAppLockModal,
    component: SettingAppLockModal,
    translationId: 'form__app_lock',
  },
  {
    name: EModalSettingRoutes.SettingProtectModal,
    component: SettingProtectionModal,
    translationId: 'action__protection',
  },
];
