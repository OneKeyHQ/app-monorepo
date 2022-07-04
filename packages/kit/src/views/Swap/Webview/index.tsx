import React from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';

import { Modal } from '@onekeyhq/components';

import WebView from '../../../components/WebView';
import { SwapRoutes, SwapRoutesParams } from '../typings';

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
