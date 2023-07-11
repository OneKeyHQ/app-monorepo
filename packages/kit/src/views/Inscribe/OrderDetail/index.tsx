import { type FC, useCallback } from 'react';

import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  VStack,
} from '@onekeyhq/components';
import type { InscribeModalRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/Inscribe';

import { useActiveWalletAccount } from '../../../hooks/redux';
import { buildTransactionDetailsUrl } from '../../../hooks/useOpenBlockBrowser';
import { openUrlExternal } from '../../../utils/openUrl';

import type { InscribeModalRoutes } from '../../../routes/routesEnum';
import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<
  InscribeModalRoutesParams,
  InscribeModalRoutes.OrderDetail
>;

export type FormValues = {
  address: string;
};
const OrderDetail: FC = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { orderHistory } = route?.params || {};
  const { network } = useActiveWalletAccount();
  const onOpenTx = useCallback(() => {
    const url = buildTransactionDetailsUrl(network, orderHistory.txid);
    openUrlExternal(url);
  }, [network, orderHistory.txid]);

  return (
    <Modal
      header={intl.formatMessage({ id: 'title__order_info' })}
      height="640px"
      footer={null}
      staticChildrenProps={{
        flex: 1,
        padding: '16px',
      }}
    >
      <ScrollView>
        <VStack space="12px">
          <Text typography="Subheading" color="text-subdued">
            {intl.formatMessage({ id: 'form__payment_info__uppercase' })}
          </Text>
          <VStack
            space="4px"
            padding="16px"
            bgColor="surface-default"
            borderRadius="12px"
            borderWidth="1px"
            borderColor="border-subdued"
          >
            <Text typography="Body2Strong" color="text-subdued">
              TXID
            </Text>
            <Pressable onPress={onOpenTx}>
              <Text typography="Body1Strong" color="text-subdued">
                {orderHistory.txid}
              </Text>
            </Pressable>
          </VStack>
        </VStack>

        <VStack space="12px" mt="24px">
          <Text typography="Subheading" color="text-subdued">
            {intl.formatMessage({ id: 'form__receive__uppercase' })}
          </Text>
          <VStack
            space="4px"
            padding="16px"
            bgColor="surface-default"
            borderRadius="12px"
            borderWidth="1px"
            borderColor="border-subdued"
          >
            <Text typography="Body2Strong" color="text-subdued">
              {intl.formatMessage({ id: 'form__receive_address' })}
            </Text>
            <Text typography="Body1Strong" color="text-subdued">
              {orderHistory.to}
            </Text>
          </VStack>
          <Text typography="Caption" color="text-subdued">
            {intl.formatMessage({
              id: 'content__the_address_above_is_a_taproot_address_to_receive_your_inscription',
            })}
          </Text>
        </VStack>

        <VStack space="12px" mt="24px">
          <Text typography="Subheading" color="text-subdued">
            {intl.formatMessage({ id: 'form__inscriptions__uppercase' })}
          </Text>
          <VStack
            space="4px"
            padding="16px"
            bgColor="surface-default"
            borderRadius="12px"
            borderWidth="1px"
            borderColor="border-subdued"
          >
            <Text typography="Body1Strong" color="text-subdued">
              {orderHistory.previewText}
            </Text>
          </VStack>
        </VStack>
      </ScrollView>
    </Modal>
  );
};

export default OrderDetail;
