import React, { FC, useMemo, useState } from 'react';

import * as ImagePicker from 'expo-image-picker';
import { Row, ZStack } from 'native-base';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  Box,
  Center,
  Form,
  Icon,
  IconButton,
  Image,
  Modal,
  Pressable,
  useForm,
  useIsVerticalLayout,
} from '@onekeyhq/components';

type SubmitValues = {
  comment: string;
};

type ImageModel = {
  loading: boolean;
  localPath: string;
};
export const ReplyTicket: FC = () => {
  const intl = useIntl();
  const { width } = useWindowDimensions();
  const isSmallScreen = useIsVerticalLayout();

  const modalWidth = isSmallScreen ? width : 400;
  const padding = isSmallScreen ? 16 : 32;

  const imageWidth = (modalWidth - padding * 2) / 5;
  const { control, handleSubmit } = useForm<SubmitValues>();
  const onSubmit = handleSubmit((data) => console.log(data));
  const [imageArr, updateImageArr] = useState<ImageModel[]>([]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.cancelled) {
      const image: ImageModel = {
        loading: false,
        localPath: result.uri,
      };
      updateImageArr([...imageArr, image]);
    }
  };

  const ImageView = (image: ImageModel, index: number) => {
    const { localPath } = image;
    return (
      <ZStack width={imageWidth} height={imageWidth}>
        <Box mt="8px" ml={0} width={imageWidth - 8} height={imageWidth - 8}>
          <Image borderRadius="12px" source={{ uri: localPath }} flex={1} />
        </Box>
        <Pressable
          onPress={() => {
            imageArr.splice(index, 1);
            updateImageArr([...imageArr]);
          }}
        >
          <Box ml={imageWidth - 20}>
            <Icon size={20} name="CloseCircleSolid" />
          </Box>
        </Pressable>
      </ZStack>
    );
  };

  const imagesList = useMemo(() => {
    if (imageArr.length > 0) {
      return (
        <Row>
          {imageArr.map((image, index) => ImageView(image, index))}
          {imageArr.length < 5 ? (
            <Pressable onPress={pickImage}>
              <Center
                mt="8px"
                width={imageWidth - 8}
                height={imageWidth - 8}
                borderRadius="12px"
                borderWidth={1}
                borderColor="border-default"
              >
                <Icon size={20} name="PlusSolid" />
              </Center>
            </Pressable>
          ) : null}
        </Row>
      );
    }
    return null;
  }, [imageArr]);

  return (
    <Modal
      header={intl.formatMessage({ id: 'action__reply' })}
      hideSecondaryAction
      primaryActionProps={{
        type: 'basic',
      }}
      primaryActionTranslationId="action__submit"
      onPrimaryActionPress={() => {
        onSubmit();
      }}
      scrollViewProps={{
        children: [
          <Form>
            <Form.Item
              label={intl.formatMessage({ id: 'form__your_reply' })}
              control={control}
              labelAddon={
                <IconButton
                  type="plain"
                  size="xs"
                  name="PhotographSolid"
                  onPress={pickImage}
                />
              }
              name="comment"
              formControlProps={{ width: 'full' }}
              defaultValue=""
            >
              <Form.Textarea borderRadius="12px" />
            </Form.Item>
            {imagesList}
          </Form>,
        ],
      }}
    />
  );
};

export default ReplyTicket;
