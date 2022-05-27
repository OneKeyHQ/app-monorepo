import React, { FC, useEffect, useLayoutEffect } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';

import { Box, Modal } from '@onekeyhq/components';
import WebView from '@onekeyhq/kit/src/components/WebView';

import {
  FiatPayModalRoutesParams,
  FiatPayRoutes,
} from '../../../routes/Modal/FiatPay';

type RouteProps = RouteProp<
  FiatPayModalRoutesParams,
  FiatPayRoutes.MoonpayWebViewModal
>;

export const MoonpayWebView: FC = () => {
  const route = useRoute<RouteProps>();
  const { url } = route?.params;
  const navigation = useNavigation();

  useLayoutEffect(() => {
    // navigation.setOptions({ title: '123' });
  }, [navigation]);
  useEffect(() => {}, []);

  return (
    <Modal
      height="560px"
      header="MoonPay"
      hideSecondaryAction
      primaryActionProps={{
        type: 'basic',
      }}
      footer={null}
      staticChildrenProps={{ flex: 1 }}
    >
      <Box flex="1">
        <WebView
          containerProps={{ borderBottomRadius: '24px' }}
          src={url}
          onSrcChange={(res) => {
            console.log('onSrcChange', res);
          }}
        />
      </Box>
    </Modal>
  );
};

export default MoonpayWebView;
