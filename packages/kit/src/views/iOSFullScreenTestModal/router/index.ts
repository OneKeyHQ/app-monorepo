import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';

import { TestIOSFullModal } from '../pages';

import { EIOSFullScreenTestModalPages } from './type';

import type { IIOSFullScreenTestModalPagesParam } from './type';

export const iOSFullScreenTestModalRouter: IModalFlowNavigatorConfig<
  EIOSFullScreenTestModalPages,
  IIOSFullScreenTestModalPagesParam
>[] = [
  {
    name: EIOSFullScreenTestModalPages.TestFullSimpleModal,
    component: TestIOSFullModal,
  },
];
