import React, { useCallback, useEffect, useMemo } from 'react';

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
  useToast,
} from '@onekeyhq/components';
import { LocaleIds } from '@onekeyhq/components/src/locale';
import { getClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import { UserInputCategory } from '@onekeyhq/engine/src/types/credential';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useGeneral, useRuntime } from '@onekeyhq/kit/src/hooks/redux';
import {
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/CreateWallet';
import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import supportedNFC from '@onekeyhq/shared/src/detector/nfc';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useNavigationActions } from '../../hooks';
import { useFormOnChangeDebounced } from '../../hooks/useFormOnChangeDebounced';
import { closeExtensionWindowIfOnboardingFinished } from '../../hooks/useOnboardingFinished';

type NavigationProps = ModalScreenProps<CreateWalletRoutesParams>;

type RouteProps = RouteProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.AddExistingWalletModal
>;

type AddExistingWalletValues = { text: string };

const AddExistingWallet = () => {
  const intl = useIntl();
  const toast = useToast();

  const { closeDrawer, resetToRoot } = useNavigationActions();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const isSmallScreen = useIsVerticalLayout();
  const { params: { mode, presetText } = { mode: 'all', presetText: '' } } =
    useRoute<RouteProps>();

  const useFormReturn = useForm<AddExistingWalletValues>({
    defaultValues: { text: presetText },
    mode: 'onBlur',
    reValidateMode: 'onBlur',
  });
  useFormOnChangeDebounced<AddExistingWalletValues>({
    useFormReturn,
  });
  const { control, handleSubmit, setValue, trigger, formState } = useFormReturn;

  const { activeNetworkId } = useGeneral();
  const { wallets } = useRuntime();

  const inputCategory = useMemo(() => {
    let onlyForcategory: UserInputCategory | undefined;
    if (mode === 'mnemonic') {
      onlyForcategory = UserInputCategory.MNEMONIC;
    } else if (mode === 'imported') {
      onlyForcategory = UserInputCategory.IMPORTED;
    } else if (mode === 'watching') {
      onlyForcategory = UserInputCategory.WATCHING;
    }
    return onlyForcategory;
  }, [mode]);
  useEffect(() => {
    if (presetText) {
      trigger('text');
    }
  }, [presetText, trigger]);

  const submitDisabled =
    !formState.isValid || !!Object.keys(formState.errors).length;

  const onSubmit = useCallback(
    async (values: AddExistingWalletValues) => {
      const { text } = values;
      const results = await backgroundApiProxy.validator.validateCreateInput({
        input: text,
        onlyFor: inputCategory,
      });

      if (results.length === 0) {
        // Check failed. Shouldn't happen.
        return;
      }

      if (results.length > 1) {
        // Multiple choices.
        navigation.navigate(
          CreateWalletModalRoutes.AddImportedOrWatchingAccountModal,
          {
            text,
            checkResults: results,
          },
        );
        return;
      }

      // No branches, directly create with default name.
      const [{ category, possibleNetworks = [] }] = results;
      if (category === UserInputCategory.MNEMONIC) {
        navigation.navigate(CreateWalletModalRoutes.AppWalletDoneModal, {
          mnemonic: text,
        });
        return;
      }

      if (possibleNetworks.length < 1) {
        // This shouldn't happen.
        console.error('No possible networks found.');
        toast.show({
          title: intl.formatMessage({ id: 'msg__unknown_error' }),
        });
        return;
      }

      if (
        category !== UserInputCategory.WATCHING &&
        category !== UserInputCategory.IMPORTED
      ) {
        // This shouldn't happen either.
        return;
      }

      const networkId =
        activeNetworkId && possibleNetworks.includes(activeNetworkId)
          ? activeNetworkId
          : possibleNetworks[0];
      const [wallet] = wallets.filter(
        (w) =>
          w.type ===
          (category === UserInputCategory.WATCHING ? 'watching' : 'imported'),
      );
      const id = wallet?.nextAccountIds?.global;
      const accountName = id ? `Account #${id}` : '';
      if (category === UserInputCategory.WATCHING) {
        try {
          await backgroundApiProxy.serviceAccount.addWatchAccount(
            networkId,
            text,
            accountName,
          );
          closeDrawer();
          resetToRoot();
          closeExtensionWindowIfOnboardingFinished();
        } catch (e) {
          const errorKey = (e as { key: LocaleIds }).key;
          toast.show({
            title: intl.formatMessage({ id: errorKey }),
          });
        }
      } else {
        navigation.navigate(
          CreateWalletModalRoutes.AddImportedAccountDoneModal,
          {
            privatekey: text,
            name: accountName,
            networkId,
          },
        );
      }
    },
    [
      navigation,
      inputCategory,
      activeNetworkId,
      closeDrawer,
      intl,
      resetToRoot,
      toast,
      wallets,
    ],
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
        mode === 'imported' || mode === 'all'
          ? intl.formatMessage({ id: 'form__private_key' })
          : ''
      }`,
      `${
        mode === 'watching' || mode === 'all'
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
        onPromise: handleSubmit(onSubmit),
        isDisabled: submitDisabled,
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
          <Form.Item
            control={control}
            name="text"
            rules={{
              validate: async (text) => {
                if (!text) {
                  return false;
                }
                if (
                  (
                    await backgroundApiProxy.validator.validateCreateInput({
                      input: text,
                      onlyFor: inputCategory,
                    })
                  ).length > 0
                ) {
                  return true;
                }
                // Special treatment for BTC address.
                try {
                  await backgroundApiProxy.validator.validateAddress(
                    'btc--0',
                    text,
                  );
                  return intl.formatMessage({
                    id: 'form__address_btc_as_wachted_account',
                  });
                } catch {
                  // pass
                }
                return intl.formatMessage({
                  id: 'form__add_exsting_wallet_invalid',
                });
              },
            }}
          >
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
        {supportedNFC && mode === 'all' ? (
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
