import { useRoute } from '@react-navigation/core';

import { Modal } from '@onekeyhq/components';

import WebView from '../../../components/WebView';

import type { SwapRoutes, SwapRoutesParams } from '../typings';
import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<SwapRoutesParams, SwapRoutes.Webview>;

const SwapWebview = () => {
  const {
    params: { url },
  } = useRoute<RouteProps>();
  return (
    <Modal footer={null}>
      <WebView src={url} />
    </Modal>
  );
};

export default SwapWebview;
