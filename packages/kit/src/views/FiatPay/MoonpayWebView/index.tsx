import type { FC } from 'react';
import { useEffect, useLayoutEffect } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';

import { Box, Modal } from '@onekeyhq/components';
import WebView from '@onekeyhq/kit/src/components/WebView';

import type {
  FiatPayModalRoutesParams,
  FiatPayRoutes,
} from '../../../routes/Modal/FiatPay';
import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<
  FiatPayModalRoutesParams,
  FiatPayRoutes.MoonpayWebViewModal
>;

export const MoonpayWebView: FC = () => {
  const route = useRoute<RouteProps>();
  const { url } = route?.params || {};
  const navigation = useNavigation();

  useLayoutEffect(() => {
    // navigation.setOptions({ title: '123' });
  }, [navigation]);
  useEffect(() => {}, []);

  return (
    <Modal
      height="560px"
      hideSecondaryAction
      primaryActionProps={{
        type: 'basic',
      }}
      footer={null}
      staticChildrenProps={{ flex: 1 }}
    >
      <Box flex="1" overflow="hidden" borderBottomRadius="12px">
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
