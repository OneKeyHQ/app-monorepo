import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import SettingCurrencyModal from '@onekeyhq/kit/src/views/Setting/Currency';
import SettingLanguageModal from '@onekeyhq/kit/src/views/Setting/Language';
import SettingListModal from '@onekeyhq/kit/src/views/Setting/List';
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
];
