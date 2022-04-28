import React, { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Dialog,
  Form,
  Icon,
  Input,
  KeyboardDismissView,
  Pressable,
  Typography,
  useForm,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import LocalAuthenticationButton from '../../components/LocalAuthenticationButton';
import { ValidationFields } from '../../components/Protected';
import { unlock as mUnlock } from '../../store/reducers/data';
import { unlock } from '../../store/reducers/status';

type FieldValues = { password: string };

const ForgetPasswordButton = () => {
  const intl = useIntl();
  const [input, setInput] = useState('');
  const [visible, setVisible] = useState(false);
  const onReset = useCallback(async () => {
    await backgroundApiProxy.serviceApp.resetApp();
    setVisible(false);
  }, []);
  return (
    <>
      <Box justifyContent="center" alignItems="center" pb="10">
        <Typography.Body2 color="text-subdued" mb="5 ">
          {intl.formatMessage({ id: 'action__forget_password' })}
        </Typography.Body2>
        <Pressable onPress={() => setVisible(true)} flexDirection="row">
          <Typography.Body1Strong color="interactive-default" mr="2">
            {intl.formatMessage({ id: 'form__reset_app' })}
          </Typography.Body1Strong>
          <Icon color="interactive-default" name="ArrowNarrowRightSolid" />
        </Pressable>
      </Box>
      <Dialog
        hasFormInsideDialog
        visible={visible}
        onClose={() => setVisible(false)}
        footerButtonProps={{
          primaryActionTranslationId: 'action__delete',
          primaryActionProps: {
            type: 'destructive',
            isDisabled: input.toUpperCase() !== 'RESET',
            onPromise: onReset,
          },
        }}
        contentProps={{
          iconType: 'danger',
          title: intl.formatMessage({
            id: 'form__reset_app',
            defaultMessage: 'Reset App',
          }),
          content: intl.formatMessage({
            id: 'modal__reset_app_desc',
            defaultMessage:
              'This will delete all the data you have created at OneKey, enter "RESET" to reset the App',
          }),
          input: (
            <Box w="full" mt="4">
              <Input
                w="full"
                value={input}
                onChangeText={(text) => setInput(text.trim())}
              />
            </Box>
          ),
        }}
      />
    </>
  );
};

const Unlock = () => {
  const intl = useIntl();
  const { dispatch, serviceApp } = backgroundApiProxy;
  const {
    control,
    handleSubmit,
    setError,
    formState: { isValid },
  } = useForm<FieldValues>({
    defaultValues: { password: '' },
    mode: 'onChange',
  });
  const isSmall = useIsVerticalLayout();
  const justifyContent = isSmall ? 'space-between' : 'center';
  const py = isSmall ? '16' : undefined;
  const onUnlock = useCallback(
    async (values: FieldValues) => {
      const isOk = await serviceApp.verifyPassword(values.password);
      if (isOk) {
        dispatch(unlock());
        dispatch(mUnlock());
      } else {
        setError('password', {
          message: intl.formatMessage({
            id: 'msg__wrong_password',
            defaultMessage: 'Wrong password.',
          }),
        });
      }
    },
    [dispatch, intl, setError, serviceApp],
  );
  const onOk = useCallback(() => {
    dispatch(unlock());
    dispatch(mUnlock());
  }, [dispatch]);
  return (
    <KeyboardDismissView>
      <Center w="full" h="full" bg="background-default">
        <Box
          maxW="96"
          p="8"
          w="full"
          h="full"
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent={justifyContent}
          position="relative"
        >
          <Box width="full" py={py}>
            <Box display="flex" flexDirection="column" alignItems="center">
              <Icon name="BrandLogoIllus" size={50} />
              <Typography.DisplayXLarge my="2">OneKey</Typography.DisplayXLarge>
              <Typography.Body1 color="text-subdued">
                {intl.formatMessage({
                  id: 'content__the_decentralized_web_awaits',
                  defaultMessage: 'The decentralized web awaits',
                })}
              </Typography.Body1>
            </Box>
            <Form mt="8">
              <Form.Item
                control={control}
                name="password"
                rules={{
                  required: intl.formatMessage({
                    id: 'form__field_is_required',
                  }),
                }}
              >
                <Form.PasswordInput
                  // press enter key to submit
                  onSubmitEditing={handleSubmit(onUnlock)}
                />
              </Form.Item>
              <Button
                size="xl"
                isDisabled={!isValid}
                type="primary"
                onPromise={handleSubmit(onUnlock)}
              >
                {intl.formatMessage({
                  id: 'action__unlock',
                  defaultMessage: 'Unlock',
                })}
              </Button>
            </Form>
            <Center mt="8">
              <LocalAuthenticationButton
                onOk={onOk}
                field={ValidationFields.Unlock}
              />
            </Center>
          </Box>
          <Center position={isSmall ? 'relative' : 'absolute'} bottom="0">
            <ForgetPasswordButton />
          </Center>
        </Box>
      </Center>
    </KeyboardDismissView>
  );
};

export default Unlock;
