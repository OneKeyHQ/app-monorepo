import React, { FC, useCallback, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
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
  Select,
  Spinner,
  Typography,
  useForm,
  useIsVerticalLayout,
  useToast,
} from '@onekeyhq/components';
import {
  SubmitRequestModalRoutesParams,
  SubmitRequestRoutes,
} from '@onekeyhq/kit/src/routes';

import { useSettings } from '../../../hooks/redux';

import { requestTicketDetail, submitUri, uploadImage } from './TicketService';
import { ImageModel } from './types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type SubmitValues = {
  email: string;
  comment: string;
  appVersion: string;
  firmwareVersion: string;
  bleVersion: string;
  seVersion: string;
};

const defaultOption = (): string => {
  switch (Platform.OS) {
    case 'ios':
      return 'App on iOS';
    case 'android':
      return 'App on Android';
    case 'web':
      return 'App on Browser';
    default:
      return 'Hardware';
  }
};

let selectOption = defaultOption();

const valueWithOption = (option: string): string => {
  switch (option) {
    case 'App on iOS':
      return 'app_on_ios';
    case 'App on Android':
      return 'app_on_android';
    case 'App on Browser':
      return 'app_on_browser';
    case 'App on Desktop':
      return 'app_on_desktop';
    case 'Hardware':
      return 'hardware';
    default:
      return '';
  }
};

type NavigationProps = NativeStackNavigationProp<
  SubmitRequestModalRoutesParams,
  SubmitRequestRoutes.SubmitRequestModal
>;

export const SubmitRequest: FC = () => {
  const intl = useIntl();
  const [isHardware, setIsHardware] = useState(false);
  const { width } = useWindowDimensions();
  const isSmallScreen = useIsVerticalLayout();
  const toast = useToast();
  const navigation = useNavigation<NavigationProps>();
  const { instanceId } = useSettings();

  const modalWidth = isSmallScreen ? width : 400;
  const padding = isSmallScreen ? 16 : 24;

  const imageWidth = (modalWidth - padding * 2) / 4;
  const [imageArr, updateImageArr] = useState<ImageModel[]>([]);
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
  }, [imageArr, instanceId]);

  const imagesList = useMemo(() => {
    const ImageView = (image: ImageModel, index: number) => {
      const { localPath, loading } = image;
      return (
        <ZStack width={`${imageWidth}px`} height={`${imageWidth}px`}>
          <Box
            mt="8px"
            ml={0}
            width={`${imageWidth - 8}px`}
            height={`${imageWidth - 8}px`}
          >
            <ZStack>
              <Image
                mt={0}
                ml={0}
                width={`${imageWidth - 8}px`}
                height={`${imageWidth - 8}px`}
                borderRadius="12px"
                source={{ uri: localPath }}
                flex={1}
              />
              {loading ? (
                <Box
                  mt={0}
                  ml={0}
                  width={`${imageWidth - 8}px`}
                  height={`${imageWidth - 8}px`}
                >
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
            <Box ml={`${imageWidth - 20}px`}>
              <Icon size={20} name="CloseCircleSolid" />
            </Box>
          </Pressable>
        </ZStack>
      );
    };
    return (
      <Row>
        {imageArr.map((image, index) => ImageView(image, index))}
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
  }, [imageArr, imageWidth, pickImage]);

  const options = [
    {
      label: intl.formatMessage({ id: 'form__hardware' }),
      value: 'Hardware',
    },
    {
      label: intl.formatMessage({ id: 'form__app_on_desktop' }),
      value: 'App on Desktop',
    },
    {
      label: intl.formatMessage({ id: 'form__app_on_browser' }),
      value: 'App on Browser',
    },
    {
      label: intl.formatMessage({ id: 'form__app_on_ios' }),
      value: 'App on iOS',
    },
    {
      label: intl.formatMessage({ id: 'form__app_on_android' }),
      value: 'App on Android',
    },
  ];
  const requestTypeChange = (value: string) => {
    selectOption = value;
    setIsHardware(value === 'Hardware');
  };

  const { control, handleSubmit } = useForm<SubmitValues>();
  const onSubmit = useCallback(
    async (formData: SubmitValues) => {
      const uploads = () => {
        const array: Array<string> = [];
        imageArr.forEach((image) => {
          if (image.token) {
            array.push(image.token);
          }
        });
        return array;
      };

      const customFields = [
        {
          'id': 360013393195,
          'value': valueWithOption(selectOption),
        },
      ];
      if (!isHardware) {
        if (formData.appVersion.length > 0) {
          customFields.push({
            'id': 360013430096,
            'value': formData.appVersion,
          });
        }
      } else {
        if (formData.seVersion.length > 0) {
          customFields.push({
            'id': 360017727195,
            'value': formData.seVersion,
          });
        }
        if (formData.bleVersion.length > 0) {
          customFields.push({
            'id': 360017731836,
            'value': formData.bleVersion,
          });
        }
        if (formData.firmwareVersion.length > 0) {
          customFields.push({
            'id': 360017731816,
            'value': formData.firmwareVersion,
          });
        }
      }
      return axios
        .post(submitUri(instanceId), {
          email: formData.email,
          ticket: {
            'subject': formData.comment,
            'custom_fields': customFields,
            'comment': {
              'body': formData.comment,
              'uploads': uploads(),
            },
          },
        })
        .then((response) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (response.data.success) {
            toast.show({
              title: intl.formatMessage({ id: 'msg__submitted_successfully' }),
            });
            navigation.goBack();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            requestTicketDetail(response.data.data.id, instanceId);
          }
        })
        .catch((error) => {
          console.log(error);
        });
    },
    [imageArr, instanceId, intl, isHardware, navigation, toast],
  );

  const optionLab = (
    <Typography.Body2Strong mb="4px" color="text-subdued">
      {intl.formatMessage({ id: 'form__hint_optional' })}
    </Typography.Body2Strong>
  );

  return (
    <Modal
      header={intl.formatMessage({ id: 'form__submit_a_request' })}
      hideSecondaryAction
      primaryActionTranslationId="action__submit"
      primaryActionProps={{ onPromise: () => handleSubmit(onSubmit)() }}
      scrollViewProps={{
        children: [
          <Form>
            <Box zIndex={999}>
              <Typography.Body2Strong mb="4px">
                {intl.formatMessage({ id: 'form__request_type' })}
              </Typography.Body2Strong>
              <Select
                containerProps={{
                  w: 'full',
                }}
                headerShown={false}
                defaultValue={selectOption}
                options={options}
                footer={null}
                onChange={requestTypeChange}
              />
            </Box>
            <Form.Item
              label={intl.formatMessage({ id: 'form__your_email' })}
              control={control}
              name="email"
              rules={{
                required: intl.formatMessage({ id: 'form__field_is_required' }),
                pattern: {
                  value: /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/,
                  message: intl.formatMessage({
                    id: 'msg__wrong_email_format',
                  }),
                },
              }}
              defaultValue=""
            >
              <Form.Input placeholder="example@gmail.com" />
            </Form.Item>
            <Form.Item
              label={intl.formatMessage({ id: 'form__your_request' })}
              labelAddon={
                <IconButton
                  type="plain"
                  size="xs"
                  name="PhotographSolid"
                  onPress={pickImage}
                />
              }
              control={control}
              rules={{
                required: intl.formatMessage({ id: 'form__field_is_required' }),
                maxLength: 1000,
              }}
              name="comment"
              formControlProps={{ width: 'full' }}
              defaultValue=""
            >
              <Form.Textarea
                placeholder={intl.formatMessage({
                  id: 'form__your_question_is',
                })}
                borderRadius="12px"
              />
            </Form.Item>
            {imagesList}
            {isHardware ? (
              [
                <Form.Item
                  label={intl.formatMessage({ id: 'form__firmware_version' })}
                  labelAddon={optionLab}
                  control={control}
                  name="firmwareVersion"
                  defaultValue=""
                >
                  <Form.Input placeholder="0.0.0" />
                </Form.Item>,
                <Form.Item
                  label={intl.formatMessage({ id: 'form__ble_version' })}
                  labelAddon={optionLab}
                  control={control}
                  name="bleVersion"
                  defaultValue=""
                >
                  <Form.Input placeholder="0.0.0" />
                </Form.Item>,
                <Form.Item
                  label={intl.formatMessage({ id: 'form__se_version' })}
                  helpText={intl.formatMessage({
                    id: 'content__these_information_may_be_found',
                  })}
                  labelAddon={optionLab}
                  control={control}
                  name="seVersion"
                  defaultValue=""
                >
                  <Form.Input placeholder="0.0.0.0" />
                </Form.Item>,
              ]
            ) : (
              <Form.Item
                label={intl.formatMessage({ id: 'form__app_version' })}
                labelAddon={optionLab}
                control={control}
                name="appVersion"
                defaultValue="1.0.0"
              >
                <Form.Input placeholder="0.0.0" />
              </Form.Item>
            )}
          </Form>,
        ],
      }}
    />
  );
};

export default SubmitRequest;
