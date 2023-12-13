import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import SettingAccountDerivationModal from '@onekeyhq/kit/src/views/Setting/AccountDerivation';
import SettingAppLockModal from '@onekeyhq/kit/src/views/Setting/AppLock';
import SettingCurrencyModal from '@onekeyhq/kit/src/views/Setting/Currency';
import SettingHardwareSdkUrlModal from '@onekeyhq/kit/src/views/Setting/HardwareSdkUrl';
import SettingLanguageModal from '@onekeyhq/kit/src/views/Setting/Language';
import SettingListModal from '@onekeyhq/kit/src/views/Setting/List';
import SettingProtectionModal from '@onekeyhq/kit/src/views/Setting/Protection';
import SettingSpendUTXOModal from '@onekeyhq/kit/src/views/Setting/SpendUTXO';
import SettingThemeModal from '@onekeyhq/kit/src/views/Setting/Theme';
import { EModalSettingRoutes } from '@onekeyhq/kit/src/views/Setting/types';
import type { IModalSettingParamList } from '@onekeyhq/kit/src/views/Setting/types';

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
