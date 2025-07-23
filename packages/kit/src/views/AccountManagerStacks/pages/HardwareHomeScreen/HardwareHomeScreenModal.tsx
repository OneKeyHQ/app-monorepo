/* eslint-disable spellcheck/spell-checker */
import { useCallback, useMemo, useState } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  ActionList,
  Alert,
  AnimatePresence,
  Icon,
  IconButton,
  Image,
  ImageCrop,
  Page,
  SizableText,
  Spinner,
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
  IHardwareHomeScreenData,
} from '@onekeyhq/kit-bg/src/services/ServiceHardware/DeviceSettingsManager';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { CoreSDKLoader } from '@onekeyhq/shared/src/hardware/instance';
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

const getCountByFlexBasis = (flexBasis: DimensionValue | undefined) => {
  if (flexBasis === '25%') {
    return 8;
  }
  if (flexBasis === '33.33333%') {
    return 9;
  }
  return 8; // 默认值
};

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
  onDelete?: (item: IHardwareHomeScreenData) => void;
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
                id: ETranslations.explore_options,
              }),
              items: [
                {
                  label: appLocale.intl.formatMessage({
                    id: ETranslations.global_delete,
                  }),
                  destructive: true,
                  onPress: () => {
                    onDelete?.(item);
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
            !isNil(item.url)
              ? item.url
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
            right="$-1"
            top="$-1"
            zIndex={101}
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
              onDelete?.(item);
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
            <Icon size="$6" name="XCircleSolid" color="$icon" />
          </Stack>
        ) : null}
      </AnimatePresence>
    </XStack>
  );
}

function UploadButton({
  canUpload,
  onUpload,
  aspectRatioInfo,
}: {
  canUpload?: boolean;
  onUpload?: () => void;
  aspectRatioInfo: IAspectRatioInfo;
}) {
  if (canUpload && onUpload) {
    return (
      <Stack
        position="relative"
        flexBasis={aspectRatioInfo.flexBasis}
        borderWidth={4}
        borderRadius="$3"
        borderColor="$transparent"
      >
        <Stack
          flex={1}
          justifyContent="center"
          alignItems="center"
          aspectRatio={aspectRatioInfo.ratio}
          borderWidth={1}
          borderRadius="$2"
          borderColor="$borderSubdued"
          onPress={onUpload}
        >
          <IconButton icon="PlusSmallOutline" onPress={onUpload} />
        </Stack>
      </Stack>
    );
  }

  return null;
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
  onDelete?: (item: IHardwareHomeScreenData) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const count = getCountByFlexBasis(aspectRatioInfo.flexBasis);
  const expandCount = onUpload ? count - 1 : count;
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
        <UploadButton
          canUpload={category.canUpload}
          onUpload={onUpload}
          aspectRatioInfo={aspectRatioInfo}
        />

        {displayData.map((item, index) => (
          <HomeScreenImageItem
            key={`${item.id}-${index}`}
            aspectRatioInfo={aspectRatioInfo}
            isLoading={isLoading}
            isSelected={selectedItem?.id === item.id}
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
  selectedItem: IHardwareHomeScreenData | undefined;
  onItemSelected: (item: IHardwareHomeScreenData | undefined) => void;
  isLoading: boolean;
  aspectRatioInfo: IAspectRatioInfo;
  imageLayout?: { width: number; height: number };
  onImageLayout?: (params: { width: number; height: number }) => void;
}) {
  const { result: deviceHomeScreens, run: runGetDeviceHomeScreens } =
    usePromiseResult<IHardwareHomeScreenData[]>(async () => {
      const data = await backgroundApiProxy.serviceHardware.getDeviceHomeScreen(
        {
          deviceId: device.id,
        },
      );
      return (
        data?.map((item: IDBHardwareHomeScreen) => ({
          id: item.id,
          uri: imageUtils.prefixBase64Uri(item.imgBase64, 'image/jpeg'), // base64 data uri
          screenHex: Buffer.from(item.imgBase64, 'base64').toString('hex'),

          isUserUpload: true,
          resType: 'custom',
        })) ?? []
      );
    }, [device.id]);

  const pressUpload = useCallback(async () => {
    if (!config || !config.size) {
      return;
    }

    if (deviceHomeScreens?.length && deviceHomeScreens.length >= 7) {
      Toast.error({
        title: appLocale.intl.formatMessage(
          {
            id: ETranslations.global_wallpaper_custom_max_limit,
          },
          {
            '0': 7,
          },
        ),
      });
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

    const name = `${USER_UPLOAD_IMG_NAME_PREFIX}${generateUUID()}`;

    const id = await backgroundApiProxy.serviceHardware.saveDeviceHomeScreen({
      deviceId: device.id,
      imgBase64: img?.base64 ?? '',
      name,
    });

    const uploadItem: IHardwareHomeScreenData = {
      id,
      uri: imageUtils.prefixBase64Uri(img?.base64 || imgBase64, 'image/jpeg'), // base64 data uri
      screenHex: img?.hex,
      isUserUpload: true,
      resType: 'custom',
    };

    onItemSelected(uploadItem);

    await runGetDeviceHomeScreens();
  }, [
    config,
    device.deviceType,
    device.id,
    deviceHomeScreens,
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
    async (item: IHardwareHomeScreenData) => {
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

function LoadingStateView({
  isLoading,
  errorMessage,
  onRetry,
}: {
  isLoading: boolean;
  errorMessage?: string;
  onRetry: () => void;
}) {
  const intl = useIntl();

  if (isLoading) {
    return (
      <YStack justifyContent="center" alignItems="center" pt="$20">
        <Spinner size="small" />
      </YStack>
    );
  }

  if (errorMessage) {
    return (
      <Alert
        icon="ErrorOutline"
        type="critical"
        title={errorMessage}
        action={{
          primary: intl.formatMessage({
            id: ETranslations.global_retry,
          }),
          onPrimaryPress() {
            onRetry();
          },
        }}
      />
    );
  }

  return null;
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
    IHardwareHomeScreenData | undefined
  >();
  const intl = useIntl();
  const [isUploadLoading, setIsUploadLoading] = useState(false);

  const { result: deviceInfo } = usePromiseResult<{
    deviceType: IDeviceType;
    canUpload: boolean;
    config: IDeviceHomeScreenConfig;
  }>(async () => {
    const config =
      await backgroundApiProxy.serviceHardware.getDeviceHomeScreenConfig({
        dbDeviceId: device?.id,
        homeScreenType: 'WallPaper',
      });

    const deviceType: IDeviceType = device?.deviceType || 'unknown';

    let canUpload = false;
    if ([EDeviceType.Classic1s, EDeviceType.ClassicPure].includes(deviceType)) {
      canUpload = true;
    }
    if ([EDeviceType.Classic, EDeviceType.Mini].includes(deviceType)) {
      canUpload = true;
    }
    if ([EDeviceType.Touch].includes(deviceType)) {
      canUpload = true;
    }
    if ([EDeviceType.Pro].includes(deviceType)) {
      canUpload = true;
    }

    return {
      deviceType: device?.deviceType || 'unknown',
      canUpload,
      config,
    };
  }, [device?.deviceType, device?.id]);

  const {
    result,
    isLoading: isHardwareHomeScreenLoading,
    run: runFetchHardwareHomeScreen,
  } = usePromiseResult<{
    homeScreenList: IHardwareHomeScreenData[];
    isLoadingError: boolean;
  }>(
    async () => {
      const { getDeviceFirmwareVersion, getDeviceUUID } = await CoreSDKLoader();

      const serialNumber = device?.featuresInfo
        ? getDeviceUUID(device.featuresInfo)
        : '';

      const firmwareVersion = device?.featuresInfo
        ? getDeviceFirmwareVersion(device.featuresInfo)?.join('.')
        : '';

      // 'unknown' | 'classic' | 'classic1s' | 'classicPure' | 'mini' | 'touch' | 'pro';
      const deviceType: IDeviceType = device?.deviceType || 'unknown';

      try {
        const dataList =
          await backgroundApiProxy.serviceHardware.fetchHardwareHomeScreen({
            deviceType,
            serialNumber,
            firmwareVersion,
          });

        return { homeScreenList: dataList, isLoadingError: false };
      } catch (error) {
        return { homeScreenList: [], isLoadingError: true };
      }
    },
    [device?.deviceType, device.featuresInfo],
    {
      watchLoading: true,
    },
  );

  const aspectRatioInfo = useAspectRatioInfo({
    sizeInfo: deviceInfo?.config?.size,
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
    const filteredDataList = result?.homeScreenList || [];

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
  }, [result?.homeScreenList]);

  const ScreenContent = useMemo(() => {
    if (isHardwareHomeScreenLoading || result?.isLoadingError) {
      return (
        <LoadingStateView
          isLoading={!!isHardwareHomeScreenLoading}
          errorMessage={
            result?.isLoadingError
              ? intl.formatMessage({
                  id: ETranslations.global_network_error_help_text,
                })
              : undefined
          }
          onRetry={runFetchHardwareHomeScreen}
        />
      );
    }

    return wallpaperCategories.map((category) => {
      return (
        <YStack key={category.title}>
          <WallpaperCategorySection
            category={category}
            selectedItem={selectedItem}
            onItemSelected={setSelectedItem}
            isLoading={isUploadLoading}
            aspectRatioInfo={aspectRatioInfo}
            imageLayout={imageLayout}
            onImageLayout={setImageLayout}
          />
        </YStack>
      );
    });
  }, [
    isHardwareHomeScreenLoading,
    result?.isLoadingError,
    wallpaperCategories,
    intl,
    runFetchHardwareHomeScreen,
    selectedItem,
    isUploadLoading,
    aspectRatioInfo,
    imageLayout,
  ]);

  return (
    <Page scrollEnabled safeAreaEnabled>
      <Page.Header title="HomeScreen" />
      <Page.Body px="$4">
        <YStack gap="$2" py="$2">
          <WallpaperCustomCategorySection
            device={device}
            config={deviceInfo?.config}
            canUpload={deviceInfo?.canUpload ?? false}
            selectedItem={selectedItem}
            onItemSelected={setSelectedItem}
            isLoading={isUploadLoading}
            aspectRatioInfo={aspectRatioInfo}
            imageLayout={imageLayout}
            onImageLayout={setImageLayout}
          />

          {ScreenContent}
        </YStack>
      </Page.Body>
      <Page.Footer
        onCancel={() => {}}
        confirmButtonProps={{
          disabled: !selectedItem || isUploadLoading,
          loading: isUploadLoading,
        }}
        onConfirm={async (_close) => {
          try {
            if (!device?.id || !selectedItem) {
              return;
            }
            setIsUploadLoading(true);

            const { nameHex, screenHex, thumbnailHex, resType, isUserUpload } =
              selectedItem;

            const isCustomScreen = resType === 'custom' || isUserUpload;

            let buildCustomHexError: string | undefined = '';

            let finallyScreenHex = '';
            let finallyThumbnailHex: string | undefined;
            try {
              if (isCustomScreen) {
                // case 1: custom upload wallpaper from uri
                // case 2: server custom wallpaper from url
                const {
                  screenHex: customScreenHex,
                  thumbnailHex: customThumbnailHex,
                } = await deviceHomeScreenUtils.buildCustomScreenHex(
                  device.id,
                  selectedItem.uri || selectedItem.url,
                  device.deviceType,
                  isUserUpload,
                  deviceInfo?.config,
                );

                finallyScreenHex = customScreenHex || '';
                finallyThumbnailHex = customThumbnailHex;
              } else {
                finallyScreenHex = screenHex || nameHex || '';
                finallyThumbnailHex = thumbnailHex;
              }
            } catch (error) {
              buildCustomHexError = (error as Error | undefined)?.message;
            }

            defaultLogger.hardware.homescreen.setHomeScreen({
              buildCustomHexError,
              deviceId: device?.id,
              deviceType: device.deviceType,
              deviceName: device.name,
              imgName: selectedItem.id,
              imgResType: resType,
              imgHex: finallyScreenHex,
              isUserUpload,
            });

            await backgroundApiProxy.serviceHardware.setDeviceHomeScreen({
              dbDeviceId: device?.id,
              screenItem: {
                ...selectedItem,
                screenHex: finallyScreenHex,
                thumbnailHex: finallyThumbnailHex,
              },
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
            setIsUploadLoading(false);
          }
        }}
      />
    </Page>
  );
}
