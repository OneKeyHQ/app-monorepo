import type { FC } from 'react';
import { useCallback, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import axios from 'axios';
import { MediaTypeOptions, launchImageLibraryAsync } from 'expo-image-picker';
import { Row } from 'native-base';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';
import uuid from 'react-native-uuid';

import {
  Center,
  Form,
  Icon,
  IconButton,
  Modal,
  Pressable,
  ToastManager,
  useForm,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { SkipAppLock } from '../../../components/AppLock';
import { useSettings } from '../../../hooks/redux';

import { ImageView } from './SubmitRequest';
import { updateTicketUri, uploadImage } from './TicketService';

import type {
  HistoryRequestModalRoutesParams,
  HistoryRequestRoutes,
  ImageModel,
} from './types';
import type { RouteProp } from '@react-navigation/core';

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
  const { id } = route?.params.order || {};
  const submitterId = route?.params.order.submitter_id;
  const modalWidth = isSmallScreen ? width : 400;
  const padding = isSmallScreen ? 16 : 24;

  const imageWidth = (modalWidth - padding * 2) / 4;
  const {
    control,
    handleSubmit,
    formState: { isValid },
  } = useForm<SubmitValues>({ mode: 'onChange' });
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
            ToastManager.show({
              title: intl.formatMessage({ id: 'msg__submitted_successfully' }),
            });
            navigation.goBack();
          }
        })
        .catch((error) => {
          console.log(error);
        });
    },
    [id, imageArr, instanceId, intl, navigation, submitterId],
  );

  const pickImage = useCallback(async () => {
    const results = await launchImageLibraryAsync({
      mediaTypes: MediaTypeOptions.Images,
      allowsEditing: false,
      base64: true,
      aspect: [4, 3],
      quality: 0.3,
    });

    if (!results.canceled) {
      const tempName = uuid.v4() as string;
      const imagename = `${tempName}.png`;
      const result = results.assets[0];
      const image: ImageModel = {
        loading: true,
        localPath: result.uri,
        filename: imagename,
      };

      let base64Image = result.uri;
      if (platformEnv.isNative && result.base64) {
        base64Image = result.base64;
      }
      updateImageArr((prev) => [...prev, image]);
      uploadImage(
        { filename: imagename, image: base64Image },
        instanceId,
        (error, responseJson) => {
          if (!error) {
            updateImageArr((prev) => {
              const imageIndex = prev.findIndex(
                (i) => i.filename === imagename,
              );
              if (imageIndex < 0) return prev;
              return [
                ...prev.slice(0, imageIndex),
                {
                  ...prev[imageIndex],
                  loading: false,
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                  token: responseJson.data.upload.token,
                },
                ...prev.slice(imageIndex + 1),
              ];
            });
          } else {
            updateImageArr((prev) => {
              const imageIndex = prev.findIndex(
                (i) => i.filename === imagename,
              );
              if (imageIndex < 0) return prev;
              return [
                ...prev.slice(0, imageIndex),
                ...prev.slice(imageIndex + 1),
              ];
            });
            ToastManager.show(
              {
                title: intl.formatMessage({ id: 'msg__upload_failed' }),
              },
              {
                type: 'error',
              },
            );
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
          key={index}
          imageModel={image}
          onDelete={(imageModel) => {
            updateImageArr((prev) => {
              const imageIndex = prev.findIndex(
                (i) => i.filename === imageModel.filename,
              );
              if (imageIndex < 0) return prev;
              return [
                ...prev.slice(0, imageIndex),
                ...prev.slice(imageIndex + 1),
              ];
            });
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
            <Icon size={20} name="PlusMini" />
          </Center>
        </Pressable>
      ) : null}
    </Row>
  );

  return (
    <>
      <SkipAppLock />
      <Modal
        header={intl.formatMessage({ id: 'action__reply' })}
        hideSecondaryAction
        primaryActionProps={{
          isDisabled: !(
            isValid && !imageArr.filter((image) => !image?.token)?.length
          ),
          onPromise: () => handleSubmit(onSubmit)(),
        }}
        primaryActionTranslationId="action__submit"
        scrollViewProps={{
          height: '560px',
          children: (
            <Form>
              <Form.Item
                label={intl.formatMessage({ id: 'form__your_reply' })}
                control={control}
                labelAddon={
                  <IconButton
                    type="plain"
                    size="xs"
                    name="PhotoMini"
                    onPress={() => {
                      if (imageArr.length < 4) {
                        pickImage();
                      }
                    }}
                  />
                }
                rules={{
                  required: intl.formatMessage({
                    id: 'form__field_is_required',
                  }),
                  maxLength: {
                    value: 1000,
                    message: intl.formatMessage({
                      id: 'msg__exceeding_the_maximum_word_limit',
                    }),
                  },
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  validate: (_) => undefined,
                }}
                name="comment"
                formControlProps={{ width: 'full' }}
                defaultValue=""
              >
                <Form.Textarea borderRadius="12px" />
              </Form.Item>
              {imagesList()}
            </Form>
          ),
        }}
      />
    </>
  );
};

export default ReplyTicket;
