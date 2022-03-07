import React, { FC, useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Form,
  Icon,
  KeyboardAvoidingView,
  KeyboardDismissView,
  Typography,
  useForm,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import LocalAuthenticationButton from '../../components/LocalAuthenticationButton';
import engine from '../../engine/EngineProvider';
import { useAppDispatch } from '../../hooks/redux';
import { runtimeUnlock } from '../../store/reducers/general';
import { unlock } from '../../store/reducers/status';

type UnlockButtonProps = {
  onOk?: (passowrd: string) => void;
  onForget?: () => void;
};

type FieldValues = { password: string };

const UnlockButton: FC<UnlockButtonProps> = ({ onOk, onForget }) => {
  const intl = useIntl();
  return (
    <Box pb="4">
      {platformEnv.isExtension ? (
        <Button leftIconName="ArrowNarrowLeftSolid" onPress={onForget}>
          {intl.formatMessage({ id: 'action__forget_password' })}
        </Button>
      ) : (
        <LocalAuthenticationButton onOk={onOk} />
      )}
    </Box>
  );
};

const Unlock = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
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
      const isOk = await engine.verifyMasterPassword(values.password);
      if (isOk) {
        dispatch(unlock());
        dispatch(runtimeUnlock());
      } else {
        setError('password', {
          message: intl.formatMessage({
            id: 'msg__wrong_password',
            defaultMessage: 'Wrong password.',
          }),
        });
      }
    },
    [dispatch, intl, setError],
  );
  const onOk = useCallback(() => {
    dispatch(unlock());
    dispatch(runtimeUnlock());
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
                onPress={handleSubmit(onUnlock)}
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
