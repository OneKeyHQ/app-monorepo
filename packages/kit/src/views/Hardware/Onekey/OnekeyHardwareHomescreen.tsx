import type { FC } from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useNavigation } from '@react-navigation/native';
import { MediaTypeOptions, launchImageLibraryAsync } from 'expo-image-picker';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  Box,
  Button,
  Icon,
  Image,
  Modal,
  Pressable,
  Text,
  ToastManager,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { OnekeyHardwareRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/HardwareOnekey';
import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import type { HomescreenItem } from '@onekeyhq/kit/src/utils/hardware/constants/homescreens';
import { getHomescreenData } from '@onekeyhq/kit/src/utils/hardware/constants/homescreens';
import {
  generateUploadResParams,
  imageCache,
} from '@onekeyhq/kit/src/utils/hardware/homescreens';
import { CoreSDKLoader } from '@onekeyhq/shared/src/device/hardwareInstance';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import type { OnekeyHardwareModalRoutes } from '../../../routes/routesEnum';
import type { DeviceUploadResourceParams } from '@onekeyfe/hd-core';
import type { RouteProp } from '@react-navigation/core';
import type { ImageInfo } from 'expo-image-picker';
import type { MessageDescriptor } from 'react-intl';

type RouteProps = RouteProp<
  OnekeyHardwareRoutesParams,
  OnekeyHardwareModalRoutes.OnekeyHardwareHomeScreenModal
>;

// eslint-disable-next-line react/no-unused-prop-types
type RenderItemParams = { item: HomescreenItem; index: number };

const OnekeyHardwareHomescreen: FC = () => {
  const intl = useIntl();

  const navigation = useNavigation();
  const { walletId, deviceType } = useRoute<RouteProps>().params;
  const [connectId, setConnectId] = useState('');
  const { bottom } = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);
  const [buttonTextId, setButtonTextId] =
    useState<MessageDescriptor['id']>('action__confirm');
  const [data, setData] = useState<HomescreenItem[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const [uploadImages, setUploadImages] =
    useState<typeof imageCache>(imageCache);
  const [isInitialized, setIsInitialized] = useState(false);

  const { engine, serviceHardware } = backgroundApiProxy;

  const isSmallScreen = useIsVerticalLayout();
  const isTouch = deviceType === 'touch' || deviceType === 'pro';

  useEffect(() => {
    engine.getHWDeviceByWalletId(walletId).then((device) => {
      if (!device) return;
      setConnectId(device.mac);
    });
  }, [walletId, engine]);

  const numColumns = 4;

  const hackLayout = (dataSource: HomescreenItem[]): HomescreenItem[] => {
    const layoutData = Array.from({
      length: dataSource.length % numColumns,
    }).map(
      (_, index) =>
        ({ name: `hackLayout-${index}`, staticPath: null } as HomescreenItem),
    );
    return layoutData;
  };

  const syncUploadImage = useCallback(
    (images: HomescreenItem[], insertMode = false) => {
      const originData = images.filter(
        (i) =>
          !i.name.startsWith('hackLayout') && !i.name.startsWith('AddAction'),
      );
      let insertIndex = originData.length;
      const dataSource = [...originData];

      Object.values(uploadImages).forEach((item) => {
        if (!originData.find((i) => i.name === item.name)) {
          dataSource.splice(insertIndex, 0, item as HomescreenItem);
          if (insertMode) {
            setActiveIndex(insertIndex);
          }
          insertIndex += 1;
        }
      });
      dataSource.push({
        name: 'AddAction',
        staticPath: null,
      } as HomescreenItem);
      return dataSource;
    },
    [uploadImages],
  );

  // initialize
  useEffect(() => {
    const homescreensMap = getHomescreenData(deviceType);
    let dataSource = Object.values(homescreensMap).map((item) => item);
    if (isTouch) {
      dataSource = syncUploadImage(dataSource);
    }
    const layoutData = hackLayout(dataSource);
    dataSource.push(...layoutData);
    setData(dataSource);
    setIsInitialized(true);
  }, [isTouch, deviceType, syncUploadImage]);

  // Organize data after uploading images
  useEffect(() => {
    if (!isInitialized) return;
    const dataSource = syncUploadImage(data, true);
    const layoutData = hackLayout(dataSource);
    dataSource.push(...layoutData);
    setData(dataSource);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadImages]);

  const addImage = useCallback((imageInfo: ImageInfo) => {
    const { uri, height, width } = imageInfo;
    const name = `upload-${Object.keys(imageCache).length}`;
    imageCache[name] = { name, staticPath: uri, height, width };
    setUploadImages({ ...imageCache });
  }, []);

  const pickImage = useCallback(async () => {
    const result = await launchImageLibraryAsync({
      mediaTypes: MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets[0].uri) {
      addImage(result.assets[0]);
    }
  }, [addImage]);

  const handleConfirm = useCallback(async () => {
    if (!connectId) return;
    if (activeIndex === null) return;
    try {
      setLoading(true);

      const selectedItem = data[activeIndex];
      if (isTouch && selectedItem.name.startsWith('upload')) {
        let uploadResParams: DeviceUploadResourceParams | undefined;
        try {
          uploadResParams = await generateUploadResParams(
            selectedItem.staticPath,
            selectedItem.width ?? 0,
            selectedItem.height ?? 0,
          );
          debugLogger.hardwareSDK.info('should upload: ', uploadResParams);
        } catch (e) {
          console.log('image operate error: ', e);
          ToastManager.show(
            {
              title: '图片处理失败，请更换图片后重试',
            },
            {
              type: 'error',
            },
          );
          return;
        }
        if (uploadResParams) {
          setButtonTextId('form__updating_resource');
          await serviceHardware.uploadResource(connectId, uploadResParams);
        }
        ToastManager.show({
          title: intl.formatMessage({ id: 'msg__change_saved' }),
        });
        return;
      }

      const { getHomeScreenHex } = await CoreSDKLoader();
      const hex = getHomeScreenHex(deviceType, selectedItem.name);
      await serviceHardware.applySettings(connectId, {
        homescreen: hex,
      });
      ToastManager.show({
        title: intl.formatMessage({ id: 'msg__change_saved' }),
      });
      navigation.getParent()?.goBack();
    } catch (e) {
      const error = deviceUtils.convertDeviceError(e);
      ToastManager.show(
        {
          title: intl.formatMessage({
            id: error.key ?? 'msg__unknown_error',
          }),
        },
        { type: 'error' },
      );
    } finally {
      setLoading(false);
      setButtonTextId('action__confirm');
    }
  }, [
    connectId,
    data,
    activeIndex,
    serviceHardware,
    intl,

    navigation,
    isTouch,
    deviceType,
  ]);

  const { width } = useWindowDimensions();
  const containerWidth = isSmallScreen ? width : 400;
  const containerPadding = isSmallScreen ? 16 : 24;
  const sperate = 16;
  const cardWidth = Math.floor(
    (containerWidth - containerPadding * 2 - sperate * 3) / 4,
  );
  const cardHeight = isTouch ? '120px' : '64px';

  const renderItem = useCallback(
    ({ item, index }: RenderItemParams) =>
      // eslint-disable-next-line no-nested-ternary
      item.name === 'AddAction' ? (
        <Box key={index} width={cardWidth} height={cardHeight}>
          <Pressable
            key={index}
            width={cardWidth}
            height={cardHeight}
            mb={4}
            onPress={() => {
              if (loading) return;
              pickImage();
            }}
          >
            <Box
              flex={1}
              height={cardHeight}
              display="flex"
              alignItems="center"
              justifyContent="center"
              borderRadius="12px"
              borderWidth="2px"
              borderColor={
                activeIndex === index ? 'interactive-default' : 'border-default'
              }
            >
              <Icon size={24} name="PlusOutline" color="icon-default" />
            </Box>
          </Pressable>
        </Box>
      ) : !item.staticPath ? (
        <Box key={index} width={cardWidth} height={cardHeight} />
      ) : (
        <Pressable
          key={index}
          width={cardWidth}
          height={cardHeight}
          mb={4}
          onPress={() => {
            if (loading) return;
            setActiveIndex(index);
          }}
        >
          <Box flex={1} height={16}>
            <Image
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              source={
                item.name.startsWith('upload')
                  ? { uri: item.staticPath }
                  : item.staticPath
              }
              resizeMode={isTouch ? 'cover' : 'contain'}
              size={cardWidth}
              height={cardHeight}
              borderRadius="12px"
              borderWidth={index === activeIndex ? '2px' : 0}
              borderColor="interactive-default"
              bgColor="#000"
            />
          </Box>
        </Pressable>
      ),
    [cardWidth, cardHeight, activeIndex, loading, pickImage, isTouch],
  );

  const flatlistProps = useMemo(
    () => ({
      contentContainerStyle: {
        paddingTop: 24,
        paddingBottom: 24,
      },
      columnWrapperStyle: {
        justifyContent: 'space-between',
      },
      data,
      numColumns,
      showsHorizontalScrollIndicator: false,
      renderItem,
      ListFooterComponent: <Box />,
      keyExtractor: (item: HomescreenItem) => item.name,
    }),
    [data, renderItem],
  );

  const footer = useMemo(
    () => (
      <>
        {isTouch && (
          <Box display="flex" alignItems="center" justifyContent="center">
            <Text>
              {intl.formatMessage({
                id: 'form__support_png_and_jpg_480_800_pixels',
              })}
            </Text>
          </Box>
        )}
        <Box
          px={{ base: 4, md: 6 }}
          mb={{ base: `${bottom}px` }}
          height={isSmallScreen ? '82px' : '70px'}
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
              id: buttonTextId,
            })}
          </Button>
        </Box>
      </>
    ),
    [
      isTouch,
      intl,
      bottom,
      isSmallScreen,
      loading,
      buttonTextId,
      handleConfirm,
    ],
  );

  return (
    <Modal
      header={intl.formatMessage({ id: 'modal__homescreen' })}
      footer={footer}
      height={isSmallScreen ? 'auto' : '600px'}
      // @ts-expect-error
      flatListProps={flatlistProps}
    />
  );
};

export default memo(OnekeyHardwareHomescreen);
