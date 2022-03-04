import React, {
  ComponentProps,
  FC,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { PermissionStatus } from 'expo-modules-core';
import { Box, Center, Image, Pressable } from 'native-base';
import { useIntl } from 'react-intl';
import {
  Image as RNImage,
  Modal as RNModal,
  useWindowDimensions,
} from 'react-native';
import uuid from 'react-native-uuid';

import { Icon, Select } from '@onekeyhq/components';

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
    let cameraPrmissions = await MediaLibrary.getPermissionsAsync(true);
    if (cameraPrmissions.status !== PermissionStatus.GRANTED) {
      cameraPrmissions = await MediaLibrary.requestPermissionsAsync(true);
    }
    if (cameraPrmissions.status === 'granted') {
      const uuidStr = uuid.v4() as string;
      const imageName = `${uuidStr}.png`;
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      const imagePath = `${FileSystem.documentDirectory}${imageName}`;
      FileSystem.downloadAsync(imageUri, imagePath)
        .then(({ uri }) => {
          console.log('Finished downloading to ', uri);
          MediaLibrary.saveToLibraryAsync(uri);
        })
        .catch((error) => {
          console.error(error);
        });
    } else {
      console.log('You did not allow permissions to camera');
    }
  }, [imageUri]);

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
          <Image
            {...rest}
            width={`${imageSize.width}px`}
            height={`${imageSize.height}px`}
            resizeMode="cover"
          />
        </Pressable>
      </Box>
    ),
    [handleClose, imageSize.height, imageSize.width, rest],
  );

  const DownloadButton = () => (
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
          <Icon name="DownloadSolid" size={20} />
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
            name: 'SaveOutline',
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
  );
  useEffect(() => {
    if (imageUri) {
      RNImage.getSize(imageUri, (width, height) => {
        // calculate image width and height
        const scaleFactor = width / screenWidth;
        const imageHeight = height / scaleFactor;
        setImageSize({ width: screenWidth, height: imageHeight });
      });
    }
  }, [imageUri, screenWidth]);

  if (!visible) {
    return null;
  }
  return (
    <RNModal
      transparent
      visible={visible}
      presentationStyle="overFullScreen"
      animationType="fade"
      supportedOrientations={['portrait']}
      hardwareAccelerated
    >
      <Pressable onPress={handleClose}>
        <Box bgColor="black" width={screenWidth} height={screenHeight}>
          <Center flex="1">{ImageView}</Center>
        </Box>
        {DownloadButton()}
      </Pressable>
    </RNModal>
  );
};

export default ImageViewer;
