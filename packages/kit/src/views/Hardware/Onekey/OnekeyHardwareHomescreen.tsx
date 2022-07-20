import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import { Box, Image, Modal, Pressable, useToast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  homescreensT1,
  homescreensT2,
} from '@onekeyhq/kit/src/config/homescreens';
import {
  OnekeyHardwareModalRoutes,
  OnekeyHardwareRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/HardwareOnekey';
import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

type RouteProps = RouteProp<
  OnekeyHardwareRoutesParams,
  OnekeyHardwareModalRoutes.OnekeyHardwareHomescreenModal
>;

type DataItem = { name: string };

const OnekeyHardwareHomescreen: FC = () => {
  const intl = useIntl();
  const toast = useToast();
  const navigation = useNavigation();
  const { walletId } = useRoute<RouteProps>().params;
  const [connectId, setConnectId] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DataItem[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const { engine, serviceHardware } = backgroundApiProxy;
  useEffect(() => {
    engine.getHWDeviceByWalletId(walletId).then((device) => {
      if (!device) return;
      setConnectId(device.mac);
      try {
        const features = JSON.parse(device.features) as IOneKeyDeviceFeatures;
        const homescreens =
          features.major_version === 1 ? homescreensT1 : homescreensT2;
        const dataSource = Object.entries(homescreens).map(
          ([name, source]) => ({ name, source }),
        );
        setData(dataSource);
      } catch (e) {
        console.log(e);
      }
    });
  }, [walletId, engine]);

  const { width } = useWindowDimensions();
  const containerWidth = platformEnv.isNative ? width : 400;
  const containerPadding = platformEnv.isNative ? 16 : 24;
  const sperate = 16;
  const cardWidth = Math.floor(
    (containerWidth - containerPadding * 2 - sperate * 3) / 4,
  );

  const renderItem = useCallback(
    ({ item, index }) => (
      <Pressable
        key={index}
        width={cardWidth}
        height={16}
        mb={4}
        onPress={() => {
          setActiveIndex(index);
        }}
      >
        <Box flex={1} height={16}>
          <Image
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            source={item.source}
            resizeMode="contain"
            size={cardWidth}
            height={16}
            borderRadius="12px"
            borderWidth={index === activeIndex ? '2px' : 0}
            borderColor="interactive-default"
            bgColor="#000"
          />
        </Box>
      </Pressable>
    ),
    [cardWidth, activeIndex],
  );

  const flatlistProps = useMemo(
    () => ({
      contentContainerStyle: {
        flex: 1,
        paddingTop: 24,
        paddingBottom: 24,
      },
      columnWrapperStyle: {
        justifyContent: 'space-between',
      },
      data,
      numColumns: 4,
      showsHorizontalScrollIndicator: false,
      renderItem,
      keyExtractor: (item: DataItem) => item.name,
    }),
    [data, renderItem],
  );

  return (
    <Modal
      header={intl.formatMessage({ id: 'modal__homescreen' })}
      footer={null}
      height="auto"
      // @ts-expect-error
      flatListProps={flatlistProps}
    />
  );
};

export default React.memo(OnekeyHardwareHomescreen);
