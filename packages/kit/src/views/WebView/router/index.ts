import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import type { IModalWebViewParamList } from '@onekeyhq/shared/src/routes';
import { EModalWebViewRoutes } from '@onekeyhq/shared/src/routes';

const WebViewModal = LazyLoadPage(() => import('../pages/WebViewModal'));

export const ModalWebViewStack: IModalFlowNavigatorConfig<
  EModalWebViewRoutes,
  IModalWebViewParamList
>[] = [
  {
    name: EModalWebViewRoutes.WebView,
    component: WebViewModal,
  },
];
