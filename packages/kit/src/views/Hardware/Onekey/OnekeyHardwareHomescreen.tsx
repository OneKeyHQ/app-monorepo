import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  Box,
  Button,
  Icon,
  Image,
  Modal,
  Pressable,
  Typography,
  useToast,
} from '@onekeyhq/components';
import {
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components/src/Provider/hooks';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  OnekeyHardwareModalRoutes,
  OnekeyHardwareRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/HardwareOnekey';
import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import {
  HomescreenItem,
  getHomescreenData,
  imageCache,
} from '@onekeyhq/kit/src/utils/hardware/constants/homescreens';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

type RouteProps = RouteProp<
  OnekeyHardwareRoutesParams,
  OnekeyHardwareModalRoutes.OnekeyHardwareHomescreenModal
>;

// eslint-disable-next-line react/no-unused-prop-types
type RenderItemParams = { item: HomescreenItem; index: number };

const OnekeyHardwareHomescreen: FC = () => {
  const intl = useIntl();
  const toast = useToast();
  const navigation = useNavigation();
  const { walletId, deviceType } = useRoute<RouteProps>().params;
  const [connectId, setConnectId] = useState('');
  const { bottom } = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<HomescreenItem[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const [uploadImages, setUploadImages] =
    useState<typeof imageCache>(imageCache);
  const [isInitialized, setIsInitialized] = useState(false);
  const initializedRef = useRef<boolean>(false);

  const { engine, serviceHardware } = backgroundApiProxy;

  const isSmallScreen = useIsVerticalLayout();

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
    (images: HomescreenItem[]) => {
      const originData = images.filter(
        (i) =>
          !i.name.startsWith('hackLayout') && !i.name.startsWith('AddAction'),
      );
      let insertIndex = originData.length;
      const dataSource = [...originData];

      Object.values(uploadImages).forEach((item) => {
        if (!originData.find((i) => i.name === item.name)) {
          dataSource.splice(insertIndex, 0, item as HomescreenItem);
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

  useEffect(() => {
    const homescreensMap = getHomescreenData(deviceType);
    let dataSource = Object.values(homescreensMap).map((item) => item);
    if (deviceType === 'touch') {
      dataSource = syncUploadImage(dataSource);
    }
    const layoutData = hackLayout(dataSource);
    dataSource.push(...layoutData);
    setData(dataSource);
    setIsInitialized(true);
    initializedRef.current = true;
  }, [deviceType, syncUploadImage]);

  useEffect(() => {
    if (!initializedRef.current) return;
    if (!isInitialized) return;
    const dataSource = syncUploadImage(data);
    const layoutData = hackLayout(dataSource);
    dataSource.push(...layoutData);
    setData(dataSource);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadImages]);

  const addImage = useCallback((uri: string) => {
    const name = `upload-${Object.keys(imageCache).length}`;
    imageCache[name] = { name, staticPath: uri };
    setUploadImages({ ...imageCache });
    // setTimeout(() => syncDataSource());
  }, []);

  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.2,
    });

    if (!result.cancelled && result.uri) {
      addImage(result.uri);
    }
  }, [addImage]);

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
  const cardHeight = deviceType === 'touch' ? '120px' : '64px';

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
              source={item.staticPath}
              resizeMode="contain"
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
    [cardWidth, cardHeight, activeIndex, loading, pickImage],
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
        {deviceType === 'touch' && (
          <Box display="flex" alignItems="center" justifyContent="center">
            <Typography.Text>
              Supports PNG or JPG, 480 x 800 pixels
            </Typography.Text>
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
              id: 'action__confirm',
            })}
          </Button>
        </Box>
      </>
    ),
    [handleConfirm, deviceType, loading, isSmallScreen, intl, bottom],
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

export default React.memo(OnekeyHardwareHomescreen);
