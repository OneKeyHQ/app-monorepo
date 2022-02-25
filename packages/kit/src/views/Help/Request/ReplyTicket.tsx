import React, { FC, useCallback, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { Row } from 'native-base';
import { useIntl } from 'react-intl';
import { Platform, useWindowDimensions } from 'react-native';
import uuid from 'react-native-uuid';

import {
  Center,
  Form,
  Icon,
  IconButton,
  Modal,
  Pressable,
  useForm,
  useIsVerticalLayout,
  useToast,
} from '@onekeyhq/components';
import {
  HistoryRequestModalRoutesParams,
  HistoryRequestRoutes,
} from '@onekeyhq/kit/src/routes/Modal/HistoryRequest';

import { useSettings } from '../../../hooks/redux';

import { ImageView } from './SubmitRequest';
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
  const padding = isSmallScreen ? 16 : 24;
  const toast = useToast();

  const imageWidth = (modalWidth - padding * 2) / 4;
  const { control, handleSubmit } = useForm<SubmitValues>();
  const [imageArr, updateImageArr] = useState<ImageModel[]>([]);

  const onSubmit = useCallback(
    async (data: SubmitValues) => {
      const uploads = () => {
        const array: Array<string> = [];
        imageArr.forEach((image) => {
          if (image.token) {
            array.push(image.token);
          }
        });
        return array;
      };
      return axios
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
    },
    [id, imageArr, instanceId, intl, navigation, submitterId, toast],
  );

  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      base64: true,
      aspect: [4, 3],
      quality: 0.3,
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
      if (Platform.OS === 'ios' && result.base64) {
        base64Image = result.base64;
      }

      imageArr.push(image);
      updateImageArr([...imageArr]);
      uploadImage(
        { filename: imagename, image: base64Image },
        instanceId,
        (error, responseJson) => {
          if (!error) {
            for (const object of imageArr) {
              if (object.filename === imagename) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                object.token = responseJson.data.upload.token;
                object.loading = false;
              }
            }
            updateImageArr([...imageArr]);
          }
        },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId]);

  const imagesList = () => (
    <Row>
      {imageArr.map((image, index) => (
        <ImageView
          imageModel={image}
          onDelete={() => {
            imageArr.splice(index, 1);
            updateImageArr([...imageArr]);
          }}
        />
      ))}
      {imageArr.length < 4 ? (
        <Pressable onPress={pickImage}>
          <Center
            mt="8px"
            width={`${imageWidth - 8}px`}
            height={`${imageWidth - 8}px`}
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

  return (
    <Modal
      header={intl.formatMessage({ id: 'action__reply' })}
      hideSecondaryAction
      primaryActionProps={{
        type: 'basic',
        onPromise: () => handleSubmit(onSubmit)(),
      }}
      primaryActionTranslationId="action__submit"
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
              rules={{
                required: intl.formatMessage({ id: 'form__field_is_required' }),
                maxLength: {
                  value: 1000,
                  message: intl.formatMessage({
                    id: 'msg__exceeding_the_maximum_word_limit',
                  }),
                },
              }}
              name="comment"
              formControlProps={{ width: 'full' }}
              defaultValue=""
            >
              <Form.Textarea borderRadius="12px" />
            </Form.Item>
            {imagesList()}
          </Form>,
        ],
      }}
    />
  );
};

export default ReplyTicket;
