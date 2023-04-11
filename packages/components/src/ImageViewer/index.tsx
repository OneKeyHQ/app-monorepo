import type { ComponentProps, FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { documentDirectory, downloadAsync } from 'expo-file-system';
import {
  getPermissionsAsync,
  requestPermissionsAsync,
  saveToLibraryAsync,
} from 'expo-media-library';
import { PermissionStatus } from 'expo-modules-core';
import { MotiView } from 'moti';
import { Box, Center, Image } from 'native-base';
import { useIntl } from 'react-intl';
import {
  Image as RNImage,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import uuid from 'react-native-uuid';

import {
  Icon,
  OverlayContainer,
  Pressable,
  Select,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import NetImage from '../NetImage';
import ToastManager from '../ToastManager';

type ImageViewerProps = {
  visible: boolean;
  onToggle: (v: boolean) => void;
} & ComponentProps<typeof Image>;

type ImageSize = {
  width: number;
  height: number;
};

const ImageViewer: FC<ImageViewerProps> = ({
  visible: outerVisible,
  onToggle,
  ...rest
}) => {
  const imageUri = rest.src as string;
  const [innerVisible, setInnerVisible] = useState(outerVisible);
  const visible = outerVisible ?? innerVisible;
  const intl = useIntl();

  const screenWidth = useWindowDimensions().width;
  const screenHeight = useWindowDimensions().height;
  const [imageSize, setImageSize] = useState<ImageSize>({
    width: screenWidth,
    height: 300,
  });
  const handleClose = useCallback(() => {
    const newStatus = !visible;
    onToggle?.(newStatus);
    setInnerVisible(newStatus);
  }, [visible, onToggle]);

  const handleSave = useCallback(async () => {
    let cameraPrmissions = await getPermissionsAsync(true);
    if (cameraPrmissions.status !== PermissionStatus.GRANTED) {
      cameraPrmissions = await requestPermissionsAsync(true);
    }
    if (cameraPrmissions.status === 'granted') {
      const uuidStr = uuid.v4() as string;
      const imageName = `${uuidStr}.png`;
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      const imagePath = `${documentDirectory}${imageName}`;
      downloadAsync(imageUri, imagePath)
        .then(({ uri }) => {
          saveToLibraryAsync(uri);
          ToastManager.show({
            title: intl.formatMessage({ id: 'msg__image_saved' }),
          });
        })
        .catch((error) => {
          console.error(error);
        });
    } else {
      // No permissions
    }
  }, [imageUri, intl]);

  const onChange = (value: string) => {
    setTimeout(() => {
      switch (value) {
        case 'save':
          handleSave();
          break;
        case 'share':
          break;
        default:
          break;
      }
    }, 200);
  };

  const ImageView = useMemo(
    () => (
      <Box>
        <Pressable onPress={handleClose}>
          {platformEnv.isNative && rest.src ? (
            <NetImage
              width={`${imageSize.width}px`}
              height={`${imageSize.height}px`}
              resizeMode="cover"
              src={rest.src}
            />
          ) : (
            <Image
              alt="-"
              {...rest}
              width={`${imageSize.width}px`}
              height={`${imageSize.height}px`}
              resizeMode="cover"
            />
          )}
        </Pressable>
      </Box>
    ),
    [handleClose, imageSize.height, imageSize.width, rest],
  );

  useEffect(() => {
    if (imageUri) {
      RNImage.getSize(imageUri, (width, height) => {
        // calculate image width and height
        if (width > 0 && height > 0) {
          const scaleFactor = width / screenWidth;
          const imageHeight = height / scaleFactor;
          setImageSize({ width: screenWidth, height: imageHeight });
        }
      });
    }
  }, [imageUri, screenWidth]);

  if (!visible) {
    return null;
  }
  return (
    <OverlayContainer>
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{
          opacity: 0,
        }}
        transition={{
          type: 'timing',
          duration: 150,
        }}
        style={StyleSheet.absoluteFill}
      >
        <Pressable onPress={handleClose}>
          <Box bgColor="black" width={screenWidth} height={screenHeight}>
            <Center flex="1">{ImageView}</Center>
          </Box>
          <Select
            title="Image Options"
            activatable={false}
            onChange={onChange}
            renderTrigger={() => (
              <Box
                position="absolute"
                width="34px"
                height="34px"
                bottom="42px"
                right="20px"
                borderRadius="12"
                borderWidth={1}
                justifyContent="center"
                alignItems="center"
                borderColor="border-default"
                bg="action-secondary-default"
              >
                <Icon name="ArrowDownTrayMini" size={20} />
              </Box>
            )}
            containerProps={{
              w: 'full',
            }}
            options={[
              {
                label: intl.formatMessage({ id: 'action__save' }),
                value: 'save',
                iconProps: {
                  name: 'InboxArrowDownOutline',
                },
              },
              {
                label: intl.formatMessage({ id: 'action__share' }),
                value: 'share',
                iconProps: {
                  name: 'ShareOutline',
                },
              },
            ]}
            footer={null}
          />
        </Pressable>
      </MotiView>
    </OverlayContainer>
  );
};

export default ImageViewer;
