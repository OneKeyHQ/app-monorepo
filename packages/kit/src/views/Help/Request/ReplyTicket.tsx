import React, { FC, useMemo, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { Row, ZStack } from 'native-base';
import { useIntl } from 'react-intl';
import { Platform, useWindowDimensions } from 'react-native';
import uuid from 'react-native-uuid';

import {
  Box,
  Center,
  Form,
  Icon,
  IconButton,
  Image,
  Modal,
  Pressable,
  Spinner,
  useForm,
  useIsVerticalLayout,
  useToast,
} from '@onekeyhq/components';
import {
  HistoryRequestModalRoutesParams,
  HistoryRequestRoutes,
} from '@onekeyhq/kit/src/routes/Modal/HistoryRequest';

import { useSettings } from '../../../hooks/redux';

import { updateTicketUri, uploadImage } from './TicketService';
import { ImageModel } from './types';

type SubmitValues = {
  comment: string;
};

type RouteProps = RouteProp<
  HistoryRequestModalRoutesParams,
  HistoryRequestRoutes.TicketDetailModal
>;

export const ReplyTicket: FC = () => {
  const intl = useIntl();
  const { width } = useWindowDimensions();
  const isSmallScreen = useIsVerticalLayout();
  const navigation = useNavigation();
  const { instanceId } = useSettings();
  const route = useRoute<RouteProps>();
  const { id } = route?.params.order;
  const submitterId = route?.params.order.submitter_id;
  const modalWidth = isSmallScreen ? width : 400;
  const padding = isSmallScreen ? 16 : 32;
  const toast = useToast();

  const imageWidth = (modalWidth - padding * 2) / 5;
  const { control, handleSubmit } = useForm<SubmitValues>();
  const [imageArr, updateImageArr] = useState<ImageModel[]>([]);

  const uploads = () => {
    const array: Array<string> = [];
    imageArr.forEach((image) => {
      if (image.token) {
        array.push(image.token);
      }
    });
    return array;
  };

  const onSubmit = handleSubmit((data) => {
    axios
      .post(updateTicketUri(id, instanceId), {
        comment: {
          'body': data.comment,
          'author_id': submitterId,
          'uploads': uploads(),
        },
      })
      .then((response) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (response.data.success) {
          toast.show({
            title: intl.formatMessage({ id: 'msg__submitted_successfully' }),
          });
          navigation.goBack();
        }
      })
      .catch((error) => {
        console.log(error);
      });
  });

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.cancelled) {
      const tempName = uuid.v4() as string;
      const imagename = `${tempName}.png`;
      const image: ImageModel = {
        loading: true,
        localPath: result.uri,
        filename: imagename,
      };

      let base64Image = result.uri;
      if (Platform.OS === 'ios') {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        base64Image = `data:image/jpg;base64,${result.base64}`;
      }
      updateImageArr([...imageArr, image]);
      uploadImage(
        { filename: imagename, image: base64Image },
        instanceId,
        (error, responseJson) => {
          if (!error) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            image.token = responseJson.data.upload.token;
            image.loading = false;
            updateImageArr([...imageArr, image]);
          }
        },
      );
    }
  };

  const ImageView = (image: ImageModel, index: number) => {
    const { localPath, loading } = image;
    return (
      <ZStack width={imageWidth} height={imageWidth}>
        <Box mt="8px" ml={0} width={imageWidth - 8} height={imageWidth - 8}>
          <ZStack>
            <Image
              mt={0}
              ml={0}
              width={imageWidth - 8}
              height={imageWidth - 8}
              borderRadius="12px"
              source={{ uri: localPath }}
              flex={1}
            />
            {loading ? (
              <Box mt={0} ml={0} width={imageWidth - 8} height={imageWidth - 8}>
                <Center flex={1}>
                  <Spinner size="sm" />
                </Center>
              </Box>
            ) : null}
          </ZStack>
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

  const imagesList = useMemo(
    () => (
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
    ),
    [imageArr],
  );

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
