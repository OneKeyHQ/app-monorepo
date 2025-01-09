import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import type { IModalShortcutsParamList } from '@onekeyhq/shared/src/routes/shortcuts';
import { EModalShortcutsRoutes } from '@onekeyhq/shared/src/routes/shortcuts';

const ShortcutsPreview = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Shortcuts/pages/ShortcutsPreview'),
);

export const ShortcutsModalRouter: IModalFlowNavigatorConfig<
  EModalShortcutsRoutes,
  IModalShortcutsParamList
>[] = [
  {
    name: EModalShortcutsRoutes.ShortcutsPreview,
    component: ShortcutsPreview,
  },
];
