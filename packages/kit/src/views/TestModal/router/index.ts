import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import type { ITestModalPagesParam } from '@onekeyhq/shared/src/routes';
import { ETestModalPages } from '@onekeyhq/shared/src/routes';
import {
  bindRouteManifest,
  testModalRouteManifest,
} from '@onekeyhq/shared/src/routes/routeManifest';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

const TestSimpleModal = LazyLoadPage(() =>
  import('../pages/TestSimpleModal').then((m) => ({
    default: m.TestSimpleModal,
  })),
);

const testModalRouteBindings: IModalFlowNavigatorConfig<
  ETestModalPages,
  ITestModalPagesParam
>[] = [
  {
    name: ETestModalPages.TestSimpleModal,
    component: TestSimpleModal,
  },
];

export const TestModalRouter = bindRouteManifest(
  testModalRouteManifest,
  testModalRouteBindings,
);
