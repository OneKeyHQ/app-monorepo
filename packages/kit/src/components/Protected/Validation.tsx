/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { throttle } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Form,
  KeyboardDismissView,
  Typography,
  useForm,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../hooks/redux';
import { useFormOnChangeDebounced } from '../../hooks/useFormOnChangeDebounced';
import { hasHardwareSupported } from '../../utils/localAuthentication';
import LocalAuthenticationButton from '../LocalAuthenticationButton';

type FieldValues = { password: string };

type ValidationProps = {
  onOk?: (text: string, isLocalAuthentication?: boolean) => void;
  hideTitle?: boolean;
  placeCenter?: boolean;
  title?: string;
  subTitle?: string;
};

const Validation: FC<ValidationProps> = ({
  onOk,
  hideTitle,
  placeCenter,
  title,
  subTitle,
}) => {
  const intl = useIntl();
  const ref = useRef<any>();
  const enableLocalAuthentication = useAppSelector(
    (s) => s.settings.enableLocalAuthentication,
  );
  const useFormReturn = useForm<FieldValues>({
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    defaultValues: { password: '' },
  });
  const { control, handleSubmit, setError } = useFormReturn;
  const { formValues } = useFormOnChangeDebounced({
    useFormReturn,
    revalidate: false,
    clearErrorIfEmpty: true,
  });
  const onSubmit = handleSubmit(async (values: FieldValues) => {
    const isOk = await backgroundApiProxy.serviceApp.verifyPassword(
      values.password,
    );
    if (isOk) {
      onOk?.(values.password, false);
    } else {
      setError('password', {
        message: intl.formatMessage({ id: 'msg__wrong_password' }),
      });
    }
  });

  const onSubmitThrottle = useMemo(
    () =>
      throttle(onSubmit, 1000, {
        trailing: false,
      }),
    [onSubmit],
  );

  const onLocalAuthenticationOk = useCallback(
    (text: string) => {
      onOk?.(text, true);
    },
    [onOk],
  );

  useEffect(() => {
    if (!enableLocalAuthentication) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      setTimeout(() => ref.current?.focus(), 100);
      return;
    }
    hasHardwareSupported().then((isOk) => {
      if (!isOk) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        setTimeout(() => ref.current?.focus(), 100);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const content = useMemo(
    () => (
      <>
        {!hideTitle ? (
          <Box mb="8">
            <Typography.DisplayLarge textAlign="center" mb={2}>
              {title ||
                intl.formatMessage({
                  id: 'Verify_Password',
                })}
            </Typography.DisplayLarge>
            <Typography.Body1 textAlign="center" color="text-subdued">
              {subTitle ||
                intl.formatMessage({
                  id: 'Verify_password_to_continue',
                })}
            </Typography.Body1>
          </Box>
        ) : null}

        <Form>
          <Form.Item
            name="password"
            defaultValue=""
            control={control}
            rules={{
              minLength: {
                value: 8,
                message: intl.formatMessage({
                  id: 'msg__password_validation',
                }),
              },
              maxLength: {
                value: 128,
                message: intl.formatMessage({
                  id: 'msg__password_validation',
                }),
              },
            }}
          >
            <Form.PasswordInput
              ref={ref}
              // press enter key to submit
              onSubmitEditing={onSubmit}
            />
          </Form.Item>
          <Button
            isDisabled={!formValues?.password}
            type="primary"
            size="xl"
            onPress={onSubmitThrottle}
          >
            {intl.formatMessage({
              id: 'action__continue',
              defaultMessage: 'Continue',
            })}
          </Button>
        </Form>
        <Center mt="8">
          <LocalAuthenticationButton onOk={onLocalAuthenticationOk} />
        </Center>
      </>
    ),
    [
      control,
      formValues?.password,
      hideTitle,
      intl,
      onLocalAuthenticationOk,
      onSubmit,
      onSubmitThrottle,
      subTitle,
      title,
    ],
  );

  if (placeCenter) {
    return (
      <KeyboardDismissView px={{ base: hideTitle ? 0 : 4, md: 0 }}>
        <Center testID="Validation" w="full" h="full" bg="background-default">
          <Box
            maxW="96"
            w="full"
            h="full"
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
          >
            {content}
          </Box>
        </Center>
      </KeyboardDismissView>
    );
  }

  return (
    <KeyboardDismissView px={{ base: hideTitle ? 0 : 4, md: 0 }}>
      {content}
    </KeyboardDismissView>
  );
};

export default Validation;
