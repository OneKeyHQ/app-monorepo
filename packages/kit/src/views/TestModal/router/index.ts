import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';

import { TestSimpleModal } from '../pages/TestSimpleModal';

import { ETestModalPages } from './type';

import type { ITestModalPagesParam } from './type';

export const TestModalRouter: IModalFlowNavigatorConfig<
  ETestModalPages,
  ITestModalPagesParam
>[] = [
  {
    name: ETestModalPages.TestSimpleModal,
    component: TestSimpleModal,
  },
];
