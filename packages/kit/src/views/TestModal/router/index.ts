import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import type { ITestModalPagesParam } from '@onekeyhq/shared/src/routes';
import { ETestModalPages } from '@onekeyhq/shared/src/routes';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

const NetworkFeeSubsidyModal = LazyLoadPage(
  () =>
    import('../../Developer/pages/Gallery/Components/stories/NetworkFeeSubsidy/NetworkFeeSubsidyModal'),
);

const TestSimpleModal = LazyLoadPage(() =>
  import('../pages/TestSimpleModal').then((m) => ({
    default: m.TestSimpleModal,
  })),
);

const NetworkFeeSubsidyHistory = LazyLoadPage(() =>
  import('../../Developer/pages/Gallery/Components/stories/NetworkFeeSubsidy/NetworkFeeSubsidyModal').then(
    (m) => ({ default: m.NetworkFeeSubsidyHistory }),
  ),
);

export const TestModalRouter: IModalFlowNavigatorConfig<
  ETestModalPages,
  ITestModalPagesParam
>[] = [
  {
    name: ETestModalPages.TestSimpleModal,
    component: TestSimpleModal,
  },
  {
    name: ETestModalPages.NetworkFeeSubsidy,
    component: NetworkFeeSubsidyModal,
    modalContentMaxWidth: 800,
    modalContentMaxHeight: 520,
  },
  {
    name: ETestModalPages.NetworkFeeSubsidyHistory,
    component: NetworkFeeSubsidyHistory,
    modalContentMaxWidth: 800,
    modalContentMaxHeight: 520,
  },
];
