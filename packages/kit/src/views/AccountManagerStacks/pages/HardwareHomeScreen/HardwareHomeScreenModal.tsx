/* eslint-disable spellcheck/spell-checker */
import { useCallback, useMemo, useState } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { isNil } from 'lodash';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  ActionList,
  AnimatePresence,
  Button,
  Icon,
  IconButton,
  Image,
  ImageCrop,
  Page,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type {
  IDBDevice,
  IDBHardwareHomeScreen,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type {
  IDeviceHomeScreenConfig,
  IDeviceHomeScreenSizeInfo,
} from '@onekeyhq/kit-bg/src/services/ServiceHardware/DeviceSettingsManager';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EAccountManagerStacksRoutes,
  IAccountManagerStacksParamList,
} from '@onekeyhq/shared/src/routes';
import deviceHomeScreenUtils from '@onekeyhq/shared/src/utils/deviceHomeScreenUtils';
import imageUtils from '@onekeyhq/shared/src/utils/imageUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import hardwareHomeScreenData from './hardwareHomeScreenData';

import type {
  IHardwareHomeScreenData,
  IHardwareHomeScreenDataWithId,
  IHardwareHomeScreenName,
} from './hardwareHomeScreenData';
import type { IDeviceType } from '@onekeyfe/hd-core';
import type { DimensionValue } from 'react-native';

const USER_UPLOAD_IMG_NAME_PREFIX = 'user_upload__';

type IAspectRatioInfo = {
  ratio: number;
  flexBasis: DimensionValue | undefined;
};

type IWallpaperCategory = {
  title: string;
  data: IHardwareHomeScreenData[];
  canUpload?: boolean;
};

function useAspectRatioInfo(params: {
  sizeInfo: IDeviceHomeScreenSizeInfo | undefined;
  deviceType: IDeviceType;
}): IAspectRatioInfo {
  const { sizeInfo, deviceType } = params;
  const media = useMedia();
  return useMemo(() => {
    let flexBasis: DimensionValue | undefined = '25%';
    let ratio = (sizeInfo?.width ?? 1) / (sizeInfo?.height ?? 1);
    if (
      [
        EDeviceType.Classic,
        EDeviceType.Mini,
        EDeviceType.Classic1s,
        EDeviceType.ClassicPure,
      ].includes(deviceType)
    ) {
      // classic mini 128x64
      ratio = 2;
      flexBasis = media.gtMd ? '25%' : '33.33333%';
    }
    return { ratio, flexBasis };
  }, [sizeInfo?.width, sizeInfo?.height, deviceType, media.gtMd]);
}

function HomeScreenImageItem({
  isLoading,
  isSelected,
  item,
  onItemSelected,
  onImageLayout,
  aspectRatioInfo,
  onDelete,
}: {
  isLoading: boolean;
  isSelected: boolean;
  item: IHardwareHomeScreenData;
  aspectRatioInfo: IAspectRatioInfo;
  onItemSelected: (item: IHardwareHomeScreenData) => void;
  onImageLayout?: (params: { width: number; height: number }) => void;
  onDelete?: (item: IHardwareHomeScreenDataWithId) => void;
}) {
  const [showDelete, setShowDelete] = useState(false);

  return (
    <XStack
      position="relative"
      flexBasis={aspectRatioInfo.flexBasis}
      borderWidth={4}
      borderRadius="$3"
      borderColor={isSelected ? '$transparent' : '$transparent'}
      onHoverIn={() => {
        if (onDelete) {
          setShowDelete(true);
        }
      }}
      onHoverOut={() => {
        if (onDelete) {
          setShowDelete(false);
        }
      }}
    >
      <Stack
        flex={1}
        hoverStyle={{
          opacity: 0.8,
        }}
        pressStyle={{
          opacity: 0.5,
        }}
        onPress={() => {
          if (isLoading) {
            return;
          }
          onItemSelected(item);
        }}
        onLongPress={() => {
          if (platformEnv.isNative) {
            ActionList.show({
              title: appLocale.intl.formatMessage({
                id: ETranslations.global_delete,
              }),
              items: [
                {
                  label: appLocale.intl.formatMessage({
                    id: ETranslations.global_delete,
                  }),
                  destructive: true,
                  onPress: () => {
                    onDelete?.(item as IHardwareHomeScreenDataWithId);
                  },
                },
              ],
            });
          }
        }}
      >
        <Image
          flex={1}
          opacity={isSelected ? 0.35 : 1}
          aspectRatio={aspectRatioInfo.ratio}
          resizeMode="contain"
          borderRadius="$2"
          onLayout={
            onImageLayout
              ? (e) => {
                  const { width, height } = e.nativeEvent.layout;
                  onImageLayout({
                    // Here we need to subtract 1, so that the upload button can be on the same line as the three images in a row
                    width: Math.floor(width) - 1,
                    height: Math.floor(height),
                  });
                }
              : undefined
          }
          source={
            !isNil(item.source)
              ? item.source
              : {
                  uri: item.uri,
                }
          }
        />
      </Stack>

      <AnimatePresence>
        {isSelected ? (
          <Stack
            position="absolute"
            right="$1.5"
            bottom="$1.5"
            zIndex={100}
            // backgroundColor="$bg"
            animation="quick"
            enterStyle={
              platformEnv.isNativeAndroid
                ? undefined
                : {
                    opacity: 0,
                    scale: 0,
                  }
            }
            exitStyle={
              platformEnv.isNativeAndroid
                ? undefined
                : {
                    opacity: 0,
                    scale: 0,
                  }
            }
          >
            <Icon size="$5" name="CheckRadioSolid" color="$iconSuccess" />
          </Stack>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showDelete ? (
          <Stack
            position="absolute"
            right="$1.5"
            top="$1.5"
            zIndex={101}
            padding="$1"
            borderRadius="$full"
            backgroundColor="$bg"
            animation="quick"
            enterStyle={
              platformEnv.isNativeAndroid
                ? undefined
                : {
                    opacity: 0,
                    scale: 0,
                  }
            }
            onPress={(e) => {
              e?.stopPropagation?.();
              onDelete?.(item as IHardwareHomeScreenDataWithId);
            }}
            exitStyle={
              platformEnv.isNativeAndroid
                ? undefined
                : {
                    opacity: 0,
                    scale: 0,
                  }
            }
          >
            <Icon size="$5" name="DeleteSolid" color="$iconCritical" />
          </Stack>
        ) : null}
      </AnimatePresence>
    </XStack>
  );
}

function WallpaperCategorySection({
  category,
  selectedItem,
  onItemSelected,
  isLoading,
  aspectRatioInfo,
  imageLayout,
  onImageLayout,
  onUpload,
  onDelete,
}: {
  category: IWallpaperCategory;
  selectedItem: IHardwareHomeScreenData | undefined;
  onItemSelected: (item: IHardwareHomeScreenData) => void;
  isLoading: boolean;
  aspectRatioInfo: IAspectRatioInfo;
  imageLayout?: { width: number; height: number };
  onImageLayout?: (params: { width: number; height: number }) => void;
  onUpload?: () => void;
  onDelete?: (item: IHardwareHomeScreenDataWithId) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const expandCount = onUpload ? 7 : 8;
  const displayData = isExpanded
    ? category.data
    : category.data.slice(0, expandCount);
  const hasMore = category.data.length > expandCount;

  const onToggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <YStack gap="$2">
      <XStack px="$1" alignItems="center" justifyContent="space-between">
        <SizableText size="$headingMd" fontWeight="600">
          {category.title}
        </SizableText>
        {hasMore ? (
          <IconButton
            icon={
              isExpanded ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'
            }
            size="small"
            onPress={onToggleExpand}
          />
        ) : null}
      </XStack>

      <XStack flexWrap="wrap">
        {/* 自定义壁纸分类显示上传按钮 */}
        {category.canUpload && imageLayout && onUpload ? (
          <Stack borderWidth={4} borderColor="$transparent">
            <Stack
              justifyContent="center"
              alignItems="center"
              borderWidth={1}
              borderRadius="$2"
              borderColor="$borderSubdued"
              w={imageLayout.width}
              h={imageLayout.height}
              onPress={onUpload}
            >
              <IconButton icon="PlusSmallOutline" onPress={onUpload} />
            </Stack>
          </Stack>
        ) : null}

        {displayData.map((item, index) => (
          <HomeScreenImageItem
            key={`${item.name}-${index}`}
            aspectRatioInfo={aspectRatioInfo}
            isLoading={isLoading}
            isSelected={selectedItem?.name === item.name}
            item={item}
            onItemSelected={onItemSelected}
            onImageLayout={
              index === 0 && !imageLayout ? onImageLayout : undefined
            }
            onDelete={onDelete}
          />
        ))}
      </XStack>
    </YStack>
  );
}

function WallpaperCustomCategorySection({
  device,
  config,
  canUpload,
  selectedItem,
  onItemSelected,
  isLoading,
  aspectRatioInfo,
  imageLayout,
  onImageLayout,
}: {
  device: IDBDevice;
  config: IDeviceHomeScreenConfig | undefined;
  canUpload: boolean;
  selectedItem:
    | IHardwareHomeScreenData
    | IHardwareHomeScreenDataWithId
    | undefined;
  onItemSelected: (item: IHardwareHomeScreenData | undefined) => void;
  isLoading: boolean;
  aspectRatioInfo: IAspectRatioInfo;
  imageLayout?: { width: number; height: number };
  onImageLayout?: (params: { width: number; height: number }) => void;
}) {
  const { result: deviceHomeScreens, run: runGetDeviceHomeScreens } =
    usePromiseResult<IHardwareHomeScreenDataWithId[]>(async () => {
      const data = await backgroundApiProxy.serviceHardware.getDeviceHomeScreen(
        {
          deviceId: device.id,
        },
      );
      return (
        data?.map((item: IDBHardwareHomeScreen) => ({
          id: item.id,
          uri: imageUtils.prefixBase64Uri(item.imgBase64, 'image/jpeg'), // base64 data uri
          hex: Buffer.from(item.imgBase64, 'base64').toString('hex'),
          thumbnailHex: Buffer.from(item.imgThumbBase64, 'base64').toString(
            'hex',
          ),
          name: item.name as IHardwareHomeScreenName,
          isUserUpload: true,
        })) ?? []
      );
    }, [device.id]);

  const pressUpload = useCallback(async () => {
    if (!config || !config.size) {
      return;
    }
    const data = await ImageCrop.openPicker({
      width: config.size?.width,
      height: config.size?.height,
    });
    console.log('cropImage:', data);
    if (!data.data) {
      return;
    }

    const originW = data?.width;
    const originH = data?.height;

    const isMonochrome = deviceHomeScreenUtils.isMonochromeScreen(
      device.deviceType,
    );

    const imgBase64: string = data.data;

    const img = await imageUtils.resizeImage({
      uri: imgBase64,

      width: config.size?.width,
      height: config.size?.height,

      originW,
      originH,
      isMonochrome,
    });
    const imgThumb = await imageUtils.resizeImage({
      uri: imgBase64,

      width: config.thumbnailSize?.width ?? config.size?.width,
      height: config.thumbnailSize?.height ?? config.size?.height,

      originW,
      originH,
      isMonochrome,
    });

    const name =
      `${USER_UPLOAD_IMG_NAME_PREFIX}${generateUUID()}` as IHardwareHomeScreenName;
    const uploadItem: IHardwareHomeScreenData = {
      uri: imageUtils.prefixBase64Uri(img?.base64 || imgBase64, 'image/jpeg'), // base64 data uri
      hex: img?.hex,
      thumbnailHex: imgThumb?.hex,
      name,
      isUserUpload: true,
    };

    onItemSelected(uploadItem);

    await backgroundApiProxy.serviceHardware.saveDeviceHomeScreen({
      deviceId: device.id,
      imgBase64: img?.base64 ?? '',
      imgThumbBase64: imgThumb?.base64 ?? '',
      name,
    });
    await runGetDeviceHomeScreens();
  }, [
    config,
    device.deviceType,
    device.id,
    onItemSelected,
    runGetDeviceHomeScreens,
  ]);

  const category = {
    title: appLocale.intl.formatMessage({
      id: ETranslations.global_wallpaper_custom,
    }),
    data: deviceHomeScreens ?? [],
    canUpload,
  };

  const onDelete = useCallback(
    async (item: IHardwareHomeScreenDataWithId) => {
      if (selectedItem && 'id' in selectedItem && selectedItem.id === item.id) {
        onItemSelected(undefined);
      }
      await backgroundApiProxy.serviceHardware.deleteDeviceHomeScreen(item.id);
      await runGetDeviceHomeScreens();
    },
    [onItemSelected, runGetDeviceHomeScreens, selectedItem],
  );

  return (
    <WallpaperCategorySection
      category={category}
      selectedItem={selectedItem}
      onItemSelected={onItemSelected}
      isLoading={isLoading}
      aspectRatioInfo={aspectRatioInfo}
      imageLayout={imageLayout}
      onImageLayout={onImageLayout}
      onUpload={canUpload ? pressUpload : undefined}
      onDelete={onDelete}
    />
  );
}

export default function HardwareHomeScreenModal({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  route,
}: IPageScreenProps<
  IAccountManagerStacksParamList,
  EAccountManagerStacksRoutes.HardwareHomeScreenModal
>) {
  const { device } = route.params;
  const [selectedItem, setSelectedItem] = useState<
    IHardwareHomeScreenData | IHardwareHomeScreenDataWithId | undefined
  >();
  const [isLoading, setIsLoading] = useState(false);
  const [resizedImagePreview, _setResizedImagePreview] = useState<{
    base64Img: string | undefined;
    base64ThumbnailImg: string | undefined;
  }>();

  const { result } = usePromiseResult<{
    dataList: IHardwareHomeScreenData[];
    deviceType: IDeviceType;
    canUpload: boolean;
    config: IDeviceHomeScreenConfig;
  }>(async () => {
    const config =
      await backgroundApiProxy.serviceHardware.getDeviceHomeScreenConfig({
        dbDeviceId: device?.id,
        homeScreenType: 'WallPaper',
      });

    // 'unknown' | 'classic' | 'classic1s' | 'classicPure' | 'mini' | 'touch' | 'pro';
    const deviceType: IDeviceType = device?.deviceType || 'unknown';
    let dataList: IHardwareHomeScreenData[] = [];
    let canUpload = false;
    if ([EDeviceType.Classic1s, EDeviceType.ClassicPure].includes(deviceType)) {
      dataList = hardwareHomeScreenData.classic1s;
      canUpload = true;
    }
    if ([EDeviceType.Classic, EDeviceType.Mini].includes(deviceType)) {
      dataList = hardwareHomeScreenData.classicMini;
      canUpload = true;
    }
    if ([EDeviceType.Touch].includes(deviceType)) {
      dataList = hardwareHomeScreenData.touch;
      canUpload = true;
    }
    if ([EDeviceType.Pro].includes(deviceType)) {
      dataList = hardwareHomeScreenData.pro;
      canUpload = true;
    }
    return {
      config,
      dataList,
      deviceType,
      canUpload,
    };
  }, [device?.deviceType, device?.id]);

  console.log('HardwareHomeScreenModal_____result', result);

  const aspectRatioInfo = useAspectRatioInfo({
    sizeInfo: result?.config?.size,
    deviceType: device.deviceType,
  });

  const [imageLayout, setImageLayout] = useState<
    | {
        width: number;
        height: number;
      }
    | undefined
  >();

  const wallpaperCategories = useMemo((): IWallpaperCategory[] => {
    const filteredDataList = result?.dataList || [];
    // .filter((item) =>
    //   result?.config?.names?.includes?.(item.name),
    // );

    const defaultWallpapers = filteredDataList.filter(
      (item) => item.wallpaperType === 'default',
    );
    const cobrandingWallpapers = filteredDataList.filter(
      (item) => item.wallpaperType === 'cobranding',
    );

    const categories = [
      {
        title: appLocale.intl.formatMessage({
          id: ETranslations.global_wallpaper_classic,
        }),
        data: defaultWallpapers,
      },
    ];

    if (cobrandingWallpapers.length > 0) {
      categories.push({
        title: appLocale.intl.formatMessage({
          id: ETranslations.global_wallpaper_cobranding,
        }),
        data: cobrandingWallpapers,
      });
    }

    return categories;
  }, [result?.dataList]);

  const buildItemCustomHex = useCallback(
    async (item: IHardwareHomeScreenData) => {
      let customHex = '';
      if (deviceHomeScreenUtils.isMonochromeScreen(device.deviceType)) {
        const imgUri =
          (await imageUtils.getBase64FromRequiredImageSource(
            item?.source,
            (...args) => {
              defaultLogger.hardware.homescreen.getBase64FromRequiredImageSource(
                ...args,
              );
            },
          )) ||
          item?.uri ||
          '';
        console.log('imgUri >>>>>>>>>>>>>>>>>++++++++>>> ', imgUri, item);
        if (!imgUri) {
          throw new OneKeyLocalError('Error imgUri not defined');
        }
        customHex = await deviceHomeScreenUtils.imagePathToHex(
          imgUri,
          device.deviceType,
        );
      }
      return customHex;
    },
    [device.deviceType],
  );

  const printAllItemsCustomHex = useCallback(async () => {
    const data = await Promise.all(
      (result?.dataList || []).map(async (item) => ({
        name: item.name,
        customHex: await buildItemCustomHex(item),
        // hex: item.hex,
      })),
    );
    console.log('printAllItemsCustomHex', data);
    console.log('printAllItemsCustomHex string', JSON.stringify(data));
    return data;
  }, [result?.dataList, buildItemCustomHex]);

  return (
    <Page scrollEnabled safeAreaEnabled>
      <Page.Header title="HomeScreen" />
      <Page.Body px="$4">
        <YStack gap="$2" py="$2">
          <WallpaperCustomCategorySection
            device={device}
            config={result?.config}
            canUpload={result?.canUpload ?? false}
            selectedItem={selectedItem}
            onItemSelected={setSelectedItem}
            isLoading={isLoading}
            aspectRatioInfo={aspectRatioInfo}
            imageLayout={imageLayout}
            onImageLayout={setImageLayout}
          />

          {wallpaperCategories.map((category) => {
            return (
              <YStack key={category.title}>
                <WallpaperCategorySection
                  category={category}
                  selectedItem={selectedItem}
                  onItemSelected={setSelectedItem}
                  isLoading={isLoading}
                  aspectRatioInfo={aspectRatioInfo}
                  imageLayout={imageLayout}
                  onImageLayout={setImageLayout}
                />
              </YStack>
            );
          })}

          {resizedImagePreview?.base64Img ? (
            <Image
              source={{
                uri: `${resizedImagePreview.base64Img}`,
              }}
            />
          ) : null}
          {resizedImagePreview?.base64ThumbnailImg ? (
            <Image
              source={{
                uri: `${resizedImagePreview.base64ThumbnailImg}`,
              }}
            />
          ) : null}
          {platformEnv.isDev ? (
            <Button onPress={printAllItemsCustomHex}>AllHex</Button>
          ) : null}
        </YStack>
      </Page.Body>
      <Page.Footer
        onCancel={() => {}}
        confirmButtonProps={{
          disabled: !selectedItem || isLoading,
          loading: isLoading,
        }}
        onConfirm={async (_close) => {
          try {
            if (!device?.id || !selectedItem) {
              return;
            }
            setIsLoading(true);

            let buildCustomHexError: string | undefined = '';
            let customHex = '';
            try {
              customHex = await buildItemCustomHex(selectedItem);
            } catch (error) {
              buildCustomHexError = (error as Error | undefined)?.message;
            }
            const customHexPreDefined =
              hardwareHomeScreenData.classicMiniHomeScreenCustomHex.find(
                (item) => item.name === selectedItem.name,
              )?.customHex;

            const imgHex =
              customHex || customHexPreDefined || selectedItem.hex || '';

            defaultLogger.hardware.homescreen.setHomeScreen({
              buildCustomHexError,
              deviceId: device?.id,
              deviceType: device.deviceType,
              deviceName: device.name,
              imgName: selectedItem.name,
              imgHex,
              customHex,
              customHexPreDefined,
              selectedItemHex: selectedItem.hex,
              isUserUpload: selectedItem.isUserUpload,
            });

            await backgroundApiProxy.serviceHardware.setDeviceHomeScreen({
              dbDeviceId: device?.id,
              imgName: selectedItem.name,
              imgHex,
              thumbnailHex: selectedItem.thumbnailHex || '',
              isUserUpload: selectedItem.isUserUpload,
            });
            // setSelectedItem(undefined);
            Toast.success({
              title: appLocale.intl.formatMessage({
                id: ETranslations.feedback_change_saved,
              }),
            });
            // Do not close the current page, let the user switch wallpapers and preview them on the device
            // close();
          } catch (error) {
            errorToastUtils.toastIfError(error);
            throw error;
          } finally {
            setIsLoading(false);
          }
        }}
      />
    </Page>
  );
}
