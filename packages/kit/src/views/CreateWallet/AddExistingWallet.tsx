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
import { UserCreateInputCategory } from '@onekeyhq/engine/src/types/credential';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/CreateWallet';
import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useDebounce } from '../../hooks';
import { setHaptics } from '../../hooks/setHaptics';

type NavigationProps = ModalScreenProps<CreateWalletRoutesParams>;

type RouteProps = RouteProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.AddExistingWalletModal
>;

type AddExistingWalletValues = { text: string };

const AddExistingWallet = () => {
  const intl = useIntl();
  const [isOk, setOk] = useState(false);
  const isSmallScreen = useIsVerticalLayout();
  const { params: { mode, presetText } = { mode: 'all', presetText: '' } } =
    useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { control, handleSubmit, setValue, getValues, trigger, watch } =
    useForm<AddExistingWalletValues>({
      defaultValues: { text: presetText },
      mode: 'onChange',
    });

  const watchedText = useDebounce(watch('text'), 400);

  useEffect(() => {
    async function validate(text: string) {
      if (!text) {
        return false;
      }
      const { category } =
        await backgroundApiProxy.validator.validateCreateInput(text);
      if (mode === 'all') {
        return category !== UserCreateInputCategory.INVALID;
      }
      if (mode === 'privatekey') {
        return category === UserCreateInputCategory.PRIVATE_KEY;
      }
      if (mode === 'mnemonic') {
        return category === UserCreateInputCategory.MNEMONIC;
      }
      if (mode === 'address') {
        return category === UserCreateInputCategory.ADDRESS;
      }
      return false;
    }
    validate(watchedText).then(setOk);
  }, [watchedText, mode]);

  const onSubmit = useCallback(
    async (values: AddExistingWalletValues) => {
      const { category, possibleNetworks: selectableNetworks } =
        await backgroundApiProxy.validator.validateCreateInput(values.text);
      if (category === UserCreateInputCategory.MNEMONIC) {
        navigation.navigate(CreateWalletModalRoutes.AppWalletDoneModal, {
          mnemonic: values.text,
        });
      } else if (category === UserCreateInputCategory.PRIVATE_KEY) {
        navigation.navigate(CreateWalletModalRoutes.AddImportedAccountModal, {
          privatekey: values.text,
          selectableNetworks,
        });
      } else if (category === UserCreateInputCategory.ADDRESS) {
        navigation.navigate(CreateWalletModalRoutes.AddWatchAccountModal, {
          address: values.text,
          selectableNetworks,
        });
      }
    },
    [navigation],
  );

  const onPaste = useCallback(async () => {
    setHaptics();
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

  const startRestorePinVerifyModal = useCallback(() => {
    navigation.navigate(
      CreateWalletModalRoutes.OnekeyLiteRestorePinCodeVerifyModal,
    );
  }, [navigation]);

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
