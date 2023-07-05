import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';
import { Keyboard } from 'react-native';

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
  useIsVerticalLayout,
} from '@onekeyhq/components';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useHtmlPreloadSplashLogoRemove } from '../../hooks/useHtmlPreloadSplashLogoRemove';
import { wait } from '../../utils/helper';
import { showSplashScreen } from '../../views/Overlay/showSplashScreen';

import AppStateUnlockButton from './AppStateUnlockButton';
import { encodeSensitiveText } from '@onekeyhq/engine/src/secret/encryptors/aes256';

const ForgetPasswordButton = () => {
  const intl = useIntl();
  const [input, setInput] = useState('');
  const [visible, setVisible] = useState(false);
  const onReset = useCallback(() => {
    showSplashScreen();
    return backgroundApiProxy.serviceApp.resetApp();
  }, []);
  return (
    <>
      <Box justifyContent="center" alignItems="center" pb="10">
        <Pressable
          onPress={() => setVisible(true)}
          flexDirection="row"
          py="1.5"
          px="2.5"
        >
          <Typography.CaptionStrong color="interactive-default" mr="2">
            {intl.formatMessage({ id: 'action__forget_password' })}
          </Typography.CaptionStrong>
        </Pressable>
      </Box>
      <Dialog
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
          content: intl.formatMessage(
            {
              id: 'modal__reset_app_desc',
            },
            { 0: 'RESET' },
          ),
          input: (
            <Box w="full" mt="4">
              <Input
                w="full"
                value={input}
                placeholder="RESET"
                onChangeText={(text) => setInput(text.trim())}
              />
            </Box>
          ),
        }}
      />
    </>
  );
};

export const AppStateUnlock = () => {
  const intl = useIntl();
  const isSmall = useIsVerticalLayout();
  const justifyContent = isSmall ? 'space-between' : 'center';
  const py = isSmall ? '16' : undefined;
  const [password, setPassword] = useState('');
  const [err, setError] = useState('');

  useHtmlPreloadSplashLogoRemove();

  const onChangeText = useCallback((text: string) => {
    setPassword(text);
    setError('');
  }, []);

  const doUnlockAction = useCallback(async (pwd: string) => {
    const isOk = await backgroundApiProxy.serviceApp.unlock(pwd);
    if (isOk) {
      appUIEventBus.emit(AppUIEventBusNames.Unlocked);
    }
    return isOk;
  }, []);

  const onUnlock = useCallback(async () => {
    const isOk = await doUnlockAction(encodeSensitiveText({ text: password }));
    if (isOk) {
      if (platformEnv.isNativeAndroid) {
        Keyboard.dismiss();
      }
      await wait(500);
    } else {
      setError(
        intl.formatMessage({
          id: 'msg__wrong_password',
          defaultMessage: 'Wrong password.',
        }),
      );
    }
  }, [doUnlockAction, password, intl]);

  const onOk = useCallback(
    (pw: string) => {
      doUnlockAction(pw);
    },
    [doUnlockAction],
  );

  return (
    <KeyboardDismissView>
      <Center testID="AppStateUnlock" w="full" h="full" bg="background-default">
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
              <Box minH={50}>
                <Icon name="BrandLogoIllus" size={50} />
              </Box>
              <Typography.DisplayXLarge my="2">OneKey</Typography.DisplayXLarge>
              <Typography.Body1 color="text-subdued">
                {intl.formatMessage({
                  id: 'content__the_decentralized_web_awaits',
                  defaultMessage: 'The decentralized web awaits',
                })}
              </Typography.Body1>
            </Box>
            <Box mt="8">
              <Form.PasswordInput
                value={password}
                onChangeText={onChangeText}
                // press enter key to submit
                onSubmitEditing={onUnlock}
              />
              {err ? <Form.FormErrorMessage message={err} /> : null}
              <Button
                size="xl"
                isDisabled={!password}
                type="primary"
                onPromise={onUnlock}
                mt="7"
              >
                {intl.formatMessage({
                  id: 'action__unlock',
                  defaultMessage: 'Unlock',
                })}
              </Button>
            </Box>
            <Center mt="8">
              <AppStateUnlockButton onOk={onOk} />
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
