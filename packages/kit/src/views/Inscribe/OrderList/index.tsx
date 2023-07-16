import type { FC } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { List, ListItem, Modal, Text } from '@onekeyhq/components';
import type { IInscriptionHistory } from '@onekeyhq/engine/src/vaults/impl/btc/inscribe/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { InscribeModalRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/Inscribe';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import { useActiveWalletAccount } from '../../../hooks';
import useFormatDate from '../../../hooks/useFormatDate';
import { InscribeModalRoutes } from '../../../routes/routesEnum';

type NavigationProps = ModalScreenProps<InscribeModalRoutesParams>;

export type FormValues = {
  address: string;
};
const OrderList: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { formatDate } = useFormatDate();
  const { networkId } = useActiveWalletAccount();

  const { serviceInscribe } = backgroundApiProxy;

  const [listData, updateListData] = useState<IInscriptionHistory[]>([]);

  useEffect(() => {
    serviceInscribe
      .getOrderHistoryList(networkId)
      .then((data) => updateListData([...data]));
  }, [networkId, serviceInscribe]);

  const onPress = useCallback(
    (item: IInscriptionHistory) => {
      navigation.navigate(InscribeModalRoutes.OrderDetail, {
        orderHistory: item,
      });
    },
    [navigation],
  );
  const renderItem = useCallback(
    ({ item, index }: { item: IInscriptionHistory; index: number }) => (
      <ListItem
        bgColor="surface-default"
        onPress={() => {
          onPress(item);
        }}
        borderTopRadius={index === 0 ? '12px' : 0}
        borderBottomRadius={index === listData.length - 1 ? '12px' : 0}
      >
        <ListItem.Column
          flex={1}
          text={{
            label: item.txid,
            labelProps: {
              numberOfLines: 2,
              typography: 'Body2Mono',
            },
            description: formatDate(new Date(item.createdAt)),
            descriptionProps: { typography: 'Body2', color: 'text-subdued' },
          }}
        />
      </ListItem>
    ),
    [formatDate, listData?.length, onPress],
  );

  return (
    <Modal
      header={intl.formatMessage({ id: 'title__inscribe_orders' })}
      height="640px"
      footer={null}
      staticChildrenProps={{
        flex: 1,
        padding: '16px',
      }}
    >
      <Text typography="Heading" mb="12px">
        {intl.formatMessage({ id: 'content__past_orders' })}
      </Text>
      <List
        m={0}
        data={listData}
        renderItem={renderItem}
        keyExtractor={(item) => item.txid}
        showDivider
      />
      <Text mt="12px" typography="Caption" color="text-subdued">
        {intl.formatMessage(
          {
            id: 'content__keep_the_latest_int_inscribing_orders_only',
          },
          { 0: '50' },
        )}
      </Text>
    </Modal>
  );
};

export default OrderList;
