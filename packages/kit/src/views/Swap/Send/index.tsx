/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/naming-convention */
import { useEffect } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';

import { Center, Modal, Spinner } from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { deviceUtils } from '../../../utils/hardware';

import type { SwapRoutes, SwapRoutesParams } from '../typings';
import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<SwapRoutesParams, SwapRoutes.Send>;

const Send = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { accountId, networkId, payload, encodedTx, onSuccess } = route.params;
  useEffect(() => {
    async function main() {
      try {
        const result = await backgroundApiProxy.serviceSwap.sendTransaction({
          accountId,
          networkId,
          payload,
          encodedTx,
        });
        navigation.goBack();
        onSuccess?.(result.result, result.decodedTx);
      } catch (e: any) {
        deviceUtils.showErrorToast(e, 'msg__unknown_error');
        navigation.goBack();
      }
    }
    main();
  }, [accountId, networkId, payload, encodedTx, onSuccess, navigation]);
  return (
    <Modal footer={null} closeable={false}>
      <Center h="full" w="full">
        <Spinner size="lg" />
      </Center>
    </Modal>
  );
};

export default Send;
