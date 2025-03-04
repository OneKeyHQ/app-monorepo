import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { ETestModalPages } from '@onekeyhq/shared/src/routes';
import type { ITestModalPagesParam } from '@onekeyhq/shared/src/routes/testModal';

import { TestSimpleModal } from '../pages/TestSimpleModal';

export const TestModalRouter: IModalFlowNavigatorConfig<
  ETestModalPages,
  ITestModalPagesParam
>[] = [
  {
    name: ETestModalPages.TestSimpleModal,
    component: TestSimpleModal,
  },
];
