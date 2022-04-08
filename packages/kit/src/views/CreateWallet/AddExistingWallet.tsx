import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Form,
  Modal,
  useForm,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { getClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/CreateWallet';
import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useDebounce, useToast } from '../../hooks';

type NavigationProps = ModalScreenProps<CreateWalletRoutesParams>;

type RouteProps = RouteProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.AddExistingWalletModal
>;

type AddExistingWalletValues = { text: string };

const AddExistingWallet = () => {
  const intl = useIntl();
  const { show } = useToast();
  const [isOk, setOk] = useState(false);
  const isSmallScreen = useIsVerticalLayout();
  const { params: { mode } = { mode: 'all' } } = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { control, handleSubmit, setValue, getValues, trigger, watch } =
    useForm<AddExistingWalletValues>({
      defaultValues: { text: '' },
      mode: 'onChange',
    });

  const watchedText = useDebounce(watch('text'), 1000);

  useEffect(() => {
    async function validate(text: string) {
      let result: boolean;
      if (!text) {
        return false;
      }
      if (mode === 'all' || mode === 'privatekey') {
        result = /[0-9A-Za-z]{64}/.test(text);
        if (result) {
          return result;
        }
      }
      if (mode === 'all' || mode === 'mnemonic') {
        result = await backgroundApiProxy.validator.validateMnemonic(text).then(
          () => true,
          () => false,
        );
        if (result) {
          return result;
        }
      }
      if (mode === 'all' || mode === 'address') {
        result = await backgroundApiProxy.validator
          .validateAddress('evm--1', text)
          .then(
            () => true,
            () => false,
          );
        if (result) {
          return result;
        }
      }
      return false;
    }
    validate(watchedText).then(setOk);
  }, [watchedText, mode]);

  const onSubmit = useCallback(
    async (values: AddExistingWalletValues) => {
      const isValidMnemonic = await backgroundApiProxy.validator
        .validateMnemonic(values.text)
        .then(
          () => true,
          () => false,
        );
      const isAddress = await backgroundApiProxy.validator
        .validateAddress('evm--1', values.text)
        .then(
          () => true,
          () => false,
        );
      const isPrivateKey = /[0-9A-Za-z]{64}/.test(values.text);
      if (isValidMnemonic) {
        navigation.navigate(CreateWalletModalRoutes.AppWalletDoneModal, {
          mnemonic: values.text,
        });
      } else if (isAddress) {
        const isDuplicated =
          await backgroundApiProxy.validator.validateAccountAddress(
            values.text,
          );
        if (isDuplicated) {
          show({
            title: intl.formatMessage({
              id: 'msg__cannot_import_existing_wallet',
            }),
          });
          return;
        }
        navigation.navigate(CreateWalletModalRoutes.AddWatchAccountModal, {
          address: values.text,
        });
      } else if (isPrivateKey) {
        navigation.navigate(CreateWalletModalRoutes.AddImportedAccountModal, {
          privatekey: values.text,
        });
      }
    },
    [navigation, show, intl],
  );

  const onPaste = useCallback(async () => {
    const pastedText = await getClipboard();
    setValue('text', pastedText);
    trigger('text');
  }, [setValue, trigger]);

  const placeholder = useMemo(() => {
    const words = [
      `${
        mode === 'mnemonic' || mode === 'all'
          ? intl.formatMessage({ id: 'form__recovery_phrase' })
          : ''
      }`,
      `${
        mode === 'privatekey' || mode === 'all'
          ? intl.formatMessage({ id: 'form__private_key' })
          : ''
      }`,
      `${
        mode === 'address' || mode === 'all'
          ? intl.formatMessage({ id: 'form__address' })
          : ''
      }`,
    ];
    return words.filter(Boolean).join(',');
  }, [intl, mode]);

  // copied from somewhere
  const startRestoreModal = useCallback(
    (inputPwd: string, callBack: () => void) => {
      navigation.navigate(CreateWalletModalRoutes.OnekeyLiteRestoreModal, {
        pwd: inputPwd,
        onRetry: () => {
          callBack?.();
        },
      });
    },
    [navigation],
  );

  const startRestorePinVerifyModal = useCallback(() => {
    navigation.navigate(CreateWalletModalRoutes.OnekeyLitePinCodeVerifyModal, {
      callBack: (inputPwd) => {
        startRestoreModal(inputPwd, () => {
          startRestorePinVerifyModal();
        });
        return true;
      },
    });
  }, [navigation, startRestoreModal]);

  return (
    <Modal
      header={intl.formatMessage({ id: 'action__i_already_have_a_wallet' })}
      primaryActionTranslationId="action__import"
      primaryActionProps={{
        isDisabled: !(
          !!watchedText &&
          watchedText === getValues('text') &&
          isOk
        ),
        onPress: handleSubmit(onSubmit),
      }}
      hideSecondaryAction
    >
      <Box
        display="flex"
        flexDirection="column"
        justifyContent={isSmallScreen ? 'space-between' : 'flex-start'}
        h="full"
      >
        <Form>
          <Form.Item control={control} name="text">
            <Form.Textarea placeholder={placeholder} h="48" />
          </Form.Item>
          {!(platformEnv.isExtension || platformEnv.isWeb) && (
            <Center>
              <Button
                size="xl"
                type="plain"
                leftIconName="DuplicateSolid"
                onPromise={onPaste}
              >
                {intl.formatMessage({ id: 'action__paste' })}
              </Button>
            </Center>
          )}
        </Form>
        {platformEnv.isNative && mode === 'all' ? (
          <Button
            size="xl"
            type="plain"
            rightIconName="ChevronRightOutline"
            iconSize={16}
            onPress={() => startRestorePinVerifyModal()}
          >
            {intl.formatMessage({ id: 'action__restore_with_onekey_lite' })}
          </Button>
        ) : null}
      </Box>
    </Modal>
  );
};

export default AddExistingWallet;
