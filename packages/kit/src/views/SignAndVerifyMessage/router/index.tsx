import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { EModalSignAndVerifyRoutes } from '@onekeyhq/shared/src/routes/signAndVerify';
import type { IModalSignAndVerifyParamList } from '@onekeyhq/shared/src/routes/signAndVerify';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

const SignAndVerifyMessage = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/SignAndVerifyMessage/pages/SignAndVerifyMessage'
    ),
);

export const ModalSignAndVerifyRouter: IModalFlowNavigatorConfig<
  EModalSignAndVerifyRoutes,
  IModalSignAndVerifyParamList
>[] = [
  {
    name: EModalSignAndVerifyRoutes.SignAndVerifyMessage,
    component: SignAndVerifyMessage,
  },
];
