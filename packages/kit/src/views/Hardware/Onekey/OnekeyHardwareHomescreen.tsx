import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  Box,
  Button,
  Image,
  Modal,
  Pressable,
  useToast,
} from '@onekeyhq/components';
import { useIsVerticalLayout } from '@onekeyhq/components/src/Provider/hooks';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  OnekeyHardwareModalRoutes,
  OnekeyHardwareRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/HardwareOnekey';
import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import { homescreensT1 } from '@onekeyhq/kit/src/utils/hardware/constants/homescreenConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

type RouteProps = RouteProp<
  OnekeyHardwareRoutesParams,
  OnekeyHardwareModalRoutes.OnekeyHardwareHomescreenModal
>;

type DataItem = { name: string; staticPath: any; hex: string };

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

  const isSmallScreen = useIsVerticalLayout();

  useEffect(() => {
    engine.getHWDeviceByWalletId(walletId).then((device) => {
      if (!device) return;
      setConnectId(device.mac);
    });
  }, [walletId, engine]);

  useEffect(() => {
    const dataSource = Object.values(homescreensT1).map((item) => item);
    setData(dataSource);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!connectId) return;
    if (activeIndex === null) return;
    try {
      setLoading(true);
      await serviceHardware.applySettings(connectId, {
        homescreen: data[activeIndex].hex,
      });
      toast.show({ title: intl.formatMessage({ id: 'msg__change_saved' }) });
      navigation.getParent()?.goBack();
    } catch (e) {
      const error = deviceUtils.convertDeviceError(e);
      toast.show(
        {
          title: intl.formatMessage({
            id: error.key ?? 'msg__unknown_error',
          }),
        },
        { type: 'error' },
      );
    } finally {
      setLoading(false);
    }
  }, [connectId, data, activeIndex, serviceHardware, intl, toast, navigation]);

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
        onPress={() => setActiveIndex(index)}
      >
        <Box flex={1} height={16}>
          <Image
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            source={item.staticPath}
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

  const footer = useMemo(
    () => (
      <Box
        px={{ base: 4, md: 6 }}
        height="70px"
        alignItems="center"
        flexDir="row"
        justifyContent={isSmallScreen ? 'center' : 'flex-end'}
        borderTopWidth={isSmallScreen ? 0 : '1px'}
        borderTopColor="border-subdued"
      >
        <Button
          flex={isSmallScreen ? 1 : undefined}
          type="primary"
          size={isSmallScreen ? 'xl' : 'base'}
          onPress={() => handleConfirm()}
          isLoading={loading}
        >
          {intl.formatMessage({
            id: 'action__done',
          })}
        </Button>
      </Box>
    ),
    [handleConfirm, loading, isSmallScreen, intl],
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
      ListFooterComponent: <Box />,
      keyExtractor: (item: DataItem) => item.name,
    }),
    [data, renderItem],
  );

  return (
    <Modal
      header={intl.formatMessage({ id: 'modal__homescreen' })}
      footer={footer}
      height={isSmallScreen ? 'auto' : '640px'}
      // @ts-expect-error
      flatListProps={flatlistProps}
    />
  );
};

export default React.memo(OnekeyHardwareHomescreen);
