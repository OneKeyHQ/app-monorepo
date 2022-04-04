import React, { FC, useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Dialog,
  Form,
  Icon,
  Input,
  KeyboardAvoidingView,
  KeyboardDismissView,
  Typography,
  useForm,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { reload } from '@onekeyhq/kit/src/utils/helper';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import LocalAuthenticationButton from '../../components/LocalAuthenticationButton';
import { unlock as mUnlock } from '../../store/reducers/data';
import { unlock } from '../../store/reducers/status';

type UnlockButtonProps = {
  onOk?: (passowrd: string) => void;
};

type FieldValues = { password: string };

const ForgetPasswordButton = () => {
  const intl = useIntl();
  const [input, setInput] = useState('');
  const [visible, setVisible] = useState(false);
  const onReset = useCallback(async () => {
    await backgroundApiProxy.serviceApp.resetApp();
    setVisible(false);

    reload();
  }, []);
  return (
    <>
      <Button
        rightIconName="ArrowNarrowRightSolid"
        type="plain"
        onPress={() => setVisible(true)}
      >
        {intl.formatMessage({ id: 'action__forget_password' })}
      </Button>
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

const UnlockButton: FC<UnlockButtonProps> = ({ onOk }) => (
  <Box pb="4">
    {platformEnv.isExtension ? (
      <ForgetPasswordButton />
    ) : (
      <LocalAuthenticationButton onOk={onOk} />
    )}
  </Box>
);

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
                label={intl.formatMessage({
                  id: 'form__password',
                  defaultMessage: 'Password',
                })}
                rules={{
                  required: intl.formatMessage({
                    id: 'form__field_is_required',
                  }),
                }}
              >
                <Form.PasswordInput />
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
          </Box>
          {isSmall ? (
            <KeyboardAvoidingView>
              <UnlockButton onOk={onOk} />
            </KeyboardAvoidingView>
          ) : undefined}
        </Box>
      </Center>
    </KeyboardDismissView>
  );
};

export default Unlock;
