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
  Select,
  Typography,
  useForm,
  useIsVerticalLayout,
} from '@onekeyhq/components';

type ImageModel = {
  loading: boolean;
  localPath: string;
};

type SubmitValues = {
  email: string;
  comment: string;
  appVersion: string;
  firmwareVersion: string;
  bleVersion: string;
  seVersion: string;
};

export const SubmitRequest: FC = () => {
  const intl = useIntl();
  const [isHardware, setIsHardware] = useState(false);
  const { width } = useWindowDimensions();
  const isSmallScreen = useIsVerticalLayout();

  const modalWidth = isSmallScreen ? width : 400;
  const padding = isSmallScreen ? 16 : 32;

  const imageWidth = (modalWidth - padding * 2) / 5;
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

  const requestTypeChange = (value: string) =>
    setIsHardware(value === 'Hardware');
  const { control, handleSubmit } = useForm<SubmitValues>();
  const onSubmit = handleSubmit((data) => console.log(data));

  const optionLab = (
    <Typography.Body2Strong mb="4px" color="text-subdued">
      {intl.formatMessage({ id: 'form__hint_optional' })}
    </Typography.Body2Strong>
  );
  return (
    <Modal
      header={intl.formatMessage({ id: 'form__submit_a_request' })}
      hideSecondaryAction
      secondaryActionProps={{
        type: 'basic',
      }}
      primaryActionTranslationId="action__submit"
      onPrimaryActionPress={() => {
        onSubmit();
      }}
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
                defaultValue="App on iOS"
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
                required: 'Email cannot be empty',
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
