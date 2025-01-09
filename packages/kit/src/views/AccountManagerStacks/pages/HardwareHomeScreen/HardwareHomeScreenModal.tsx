import { useCallback, useMemo, useState } from 'react';

import { isNil } from 'lodash';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  AnimatePresence,
  Button,
  Icon,
  IconButton,
  Image,
  ImageCrop,
  Page,
  Stack,
  Toast,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type {
  IDeviceHomeScreenConfig,
  IDeviceHomeScreenSizeInfo,
} from '@onekeyhq/kit-bg/src/services/ServiceHardware/DeviceSettingsManager';
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
import uploadedHomeScreenCache from './uploadedHomeScreenCache';

import type {
  IHardwareHomeScreenData,
  IHardwareHomeScreenName,
} from './hardwareHomeScreenData';
import type { IDeviceType } from '@onekeyfe/hd-core';
import type { DimensionValue } from 'react-native';

const USER_UPLOAD_IMG_NAME_PREFIX = 'user_upload__';

type IAspectRatioInfo = {
  ratio: number;
  flexBasis: DimensionValue | undefined;
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
    if (['classic', 'mini', 'classic1s'].includes(deviceType)) {
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
}: {
  isLoading: boolean;
  isSelected: boolean;
  item: IHardwareHomeScreenData;
  aspectRatioInfo: IAspectRatioInfo;
  onItemSelected: (item: IHardwareHomeScreenData) => void;
  onImageLayout?: (params: { width: number; height: number }) => void;
}) {
  return (
    <XStack
      position="relative"
      flexBasis={aspectRatioInfo.flexBasis}
      borderWidth={4}
      borderRadius="$3"
      borderColor={isSelected ? '$transparent' : '$transparent'}
      hoverStyle={{
        opacity: 0.7,
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
    </XStack>
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
    IHardwareHomeScreenData | undefined
  >();
  const [isLoading, setIsLoading] = useState(false);
  const [resizedImagePreview, setResizedImagePreview] = useState<{
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

    // 'unknown' | 'classic' | 'classic1s' | 'mini' | 'touch' | 'pro';
    const deviceType: IDeviceType = device?.deviceType || 'unknown';
    let dataList: IHardwareHomeScreenData[] = [];
    let canUpload = false;
    if (['classic', 'mini', 'classic1s'].includes(deviceType)) {
      dataList = hardwareHomeScreenData.classicMini;
      canUpload = true;
    }
    if (['touch'].includes(deviceType)) {
      dataList = hardwareHomeScreenData.touch;
      canUpload = true;
    }
    if (['pro'].includes(deviceType)) {
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

  const [uploadItems, setUploadItems] = useState<IHardwareHomeScreenData[]>([
    ...uploadedHomeScreenCache.getCacheList(device?.id),
  ]);

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

  const pressUpload = useCallback(async () => {
    if (!result?.config || !result?.config.size) {
      return;
    }
    const data = await ImageCrop.openPicker({
      width: result?.config.size?.width,
      height: result?.config.size?.height,
    });
    console.log('cropImage:', data);
    if (!data.data) {
      return;
    }

    // const originW = result?.config.size?.width;
    // const originH = result?.config.size?.height;
    const originW = data?.width;
    const originH = data?.height;

    const isMonochrome = deviceHomeScreenUtils.isMonochromeScreen(
      device.deviceType,
    );

    const imgBase64: string = data.data;

    const img = await imageUtils.resizeImage({
      uri: imgBase64,

      width: result?.config.size?.width,
      height: result?.config.size?.height,

      originW,
      originH,
      isMonochrome,
    });
    const imgThumb = await imageUtils.resizeImage({
      uri: imgBase64,

      width: result?.config.thumbnailSize?.width ?? result?.config.size?.width,
      height:
        result?.config.thumbnailSize?.height ?? result?.config.size?.height,

      originW,
      originH,
      isMonochrome,
    });

    // setResizedImagePreview({
    //   base64Img: img?.uri,
    //   base64ThumbnailImg: imgThumb?.uri,
    // });

    const name =
      `${USER_UPLOAD_IMG_NAME_PREFIX}${generateUUID()}` as IHardwareHomeScreenName;
    const uploadItem: IHardwareHomeScreenData = {
      uri: imageUtils.prefixBase64Uri(img?.base64 || imgBase64, 'image/jpeg'), // base64 data uri
      hex: img?.hex,
      thumbnailHex: imgThumb?.hex,
      name,
      isUserUpload: true,
    };
    setUploadItems([...uploadItems, uploadItem]);
    setSelectedItem(uploadItem);
    uploadedHomeScreenCache.saveCache(device?.id, uploadItem);
  }, [result?.config, device.deviceType, device?.id, uploadItems]);

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
          throw new Error('Error imgUri not defined');
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
        <XStack flexWrap="wrap" px="$1" py="$2">
          {(result?.dataList || []).map((item, index) => {
            if (!result?.config?.names?.includes?.(item.name)) {
              return null;
            }
            return (
              <HomeScreenImageItem
                aspectRatioInfo={aspectRatioInfo}
                key={index}
                isLoading={isLoading}
                isSelected={selectedItem?.name === item.name}
                item={item}
                onItemSelected={setSelectedItem}
                onImageLayout={
                  index === 0
                    ? (p) => {
                        setImageLayout(p);
                      }
                    : undefined
                }
              />
            );
          })}
          {uploadItems.map((item, index) => (
            <HomeScreenImageItem
              aspectRatioInfo={aspectRatioInfo}
              key={index}
              isLoading={isLoading}
              isSelected={selectedItem?.name === item.name}
              item={item}
              onItemSelected={setSelectedItem}
            />
          ))}
          {result?.canUpload && imageLayout ? (
            <Stack borderWidth={4} borderColor="$transparent">
              <Stack
                justifyContent="center"
                alignItems="center"
                borderWidth={1}
                borderRadius="$2"
                borderColor="$borderSubdued"
                w={imageLayout?.width}
                h={imageLayout?.height}
                onPress={pressUpload}
              >
                <IconButton icon="PlusSmallOutline" onPress={pressUpload} />
              </Stack>
            </Stack>
          ) : null}

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
        </XStack>
      </Page.Body>
      <Page.Footer
        onCancel={() => {}}
        confirmButtonProps={{
          disabled: !selectedItem || isLoading,
          loading: isLoading,
        }}
        onConfirm={async (close) => {
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
