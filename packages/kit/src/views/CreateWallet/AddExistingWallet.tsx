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
import NameServiceResolver, {
  useNameServiceStatus,
} from '@onekeyhq/kit/src/components/NameServiceResolver';
import { useGeneral, useRuntime } from '@onekeyhq/kit/src/hooks/redux';
import {
  CreateWalletRoutesParams,
  IAddExistingWalletModalParams,
  IAddImportedAccountDoneModalParams,
  IAddImportedOrWatchingAccountModalParams,
  IAppWalletDoneModalParams,
} from '@onekeyhq/kit/src/routes/Modal/CreateWallet';
import {
  CreateWalletModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';
import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import supportedNFC from '@onekeyhq/shared/src/detector/nfc';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useFormOnChangeDebounced } from '../../hooks/useFormOnChangeDebounced';
import { useOnboardingDone } from '../../hooks/useOnboardingRequired';
import { useOnboardingContext } from '../Onboarding/OnboardingContext';
import { EOnboardingRoutes } from '../Onboarding/routes/enums';

type NavigationProps = ModalScreenProps<CreateWalletRoutesParams>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type RouteProps = RouteProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.AddExistingWalletModal
>;

type AddExistingWalletValues = { text: string };

const emptyParams = Object.freeze({});

function useAddExistingWallet({
  onMultipleResults,
  onAddMnemonicAuth,
  onAddImportedAuth,
  onAddWatchingDone,
}: {
  onMultipleResults: (p: IAddImportedOrWatchingAccountModalParams) => void;
  onAddMnemonicAuth: (p: IAppWalletDoneModalParams) => void;
  onAddImportedAuth: (p: IAddImportedAccountDoneModalParams) => void;
  onAddWatchingDone: () => void;
}) {
  const route = useRoute();
  const intl = useIntl();
  const toast = useToast();
  const { activeNetworkId } = useGeneral();
  const { wallets } = useRuntime();

  const { mode = 'all', presetText = '' } = (route.params ||
    emptyParams) as IAddExistingWalletModalParams;
  const useFormReturn = useForm<AddExistingWalletValues>({
    defaultValues: { text: presetText || '' },
    mode: 'onBlur',
    reValidateMode: 'onBlur',
  });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { isValid, formValues } =
    useFormOnChangeDebounced<AddExistingWalletValues>({
      useFormReturn,
      revalidate: false,
      clearErrorIfEmpty: true,
    });
  const { control, handleSubmit, setValue, trigger } = useFormReturn;
  // const submitDisabled = !isValid;
  const submitDisabled = !formValues?.text;
  const inputCategory = useMemo(() => {
    let onlyForcategory: UserInputCategory | undefined;
    if (mode === 'mnemonic') {
      // HD
      onlyForcategory = UserInputCategory.MNEMONIC;
    } else if (mode === 'imported') {
      // PrivateKey
      onlyForcategory = UserInputCategory.IMPORTED;
    } else if (mode === 'watching') {
      // Address
      onlyForcategory = UserInputCategory.WATCHING;
    }
    return onlyForcategory;
  }, [mode]);

  const onSubmit = useCallback(
    async (values: AddExistingWalletValues) => {
      const { text } = values;
      if (!text) {
        return;
      }
      const results = await backgroundApiProxy.validator.validateCreateInput({
        input: text,
        onlyFor: inputCategory,
      });

      if (results.length === 0) {
        // Check failed. Shouldn't happen.
        return;
      }

      if (results.length > 1) {
        onMultipleResults({
          text,
          checkResults: results,
          onSuccess() {
            toast.show({
              title: intl.formatMessage({ id: 'msg__account_imported' }),
            });
          },
        });
        return;
      }

      // No branches, directly create with default name.
      const [{ category, possibleNetworks = [] }] = results;
      if (category === UserInputCategory.MNEMONIC) {
        onAddMnemonicAuth({
          mnemonic: text,
          onSuccess() {
            toast.show({
              title: intl.formatMessage({ id: 'msg__account_imported' }),
            });
          },
        });
        return;
      }

      if (possibleNetworks.length < 1) {
        // This shouldn't happen.
        console.error('No possible networks found.');
        toast.show(
          {
            title: intl.formatMessage({ id: 'msg__unknown_error' }),
          },
          { type: 'error' },
        );
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
          toast.show({
            title: intl.formatMessage({ id: 'msg__account_imported' }),
          });
          onAddWatchingDone();
        } catch (e) {
          const errorKey = (e as { key: LocaleIds }).key;
          toast.show(
            {
              title: intl.formatMessage({ id: errorKey }),
            },
            { type: 'error' },
          );
        }
      } else {
        onAddImportedAuth({
          privatekey: text,
          name: accountName,
          networkId,
          onSuccess() {
            toast.show({
              title: intl.formatMessage({ id: 'msg__account_imported' }),
            });
          },
        });
      }
    },
    [
      activeNetworkId,
      inputCategory,
      intl,
      onAddImportedAuth,
      onAddMnemonicAuth,
      onAddWatchingDone,
      onMultipleResults,
      toast,
      wallets,
    ],
  );

  useEffect(() => {
    if (presetText) {
      trigger('text');
    }
  }, [presetText, trigger]);

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
      mode === 'watching' || mode === 'all'
        ? `ENS ${intl.formatMessage({ id: 'content__or_lowercase' })} .bit`
        : '',
    ];
    return `${intl.formatMessage({
      id: 'content__enter',
    })} ${words.filter(Boolean).join(', ')}`;
  }, [intl, mode]);

  return {
    intl,
    handleSubmit,
    submitDisabled,
    onSubmit,
    control,
    inputCategory,
    placeholder,
    onPaste,
    mode,
  };
}

function AddExistingWalletView(
  props: ReturnType<typeof useAddExistingWallet> & {
    children?: any;
    showSubmitButton?: boolean;
    showPasteButton?: boolean;
  },
) {
  const {
    intl,
    handleSubmit,
    submitDisabled,
    onSubmit,
    control,
    inputCategory,
    placeholder,
    onPaste,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mode,
    children,
    showSubmitButton,
    showPasteButton,
  } = props;
  const {
    onChange: onNameServiceChange,
    disableSubmitBtn,
    address,
  } = useNameServiceStatus();
  const isSmallScreen = useIsVerticalLayout();
  const isVerticalLayout = useIsVerticalLayout();

  return (
    <Box
      display="flex"
      flexDirection="column"
      justifyContent={isSmallScreen ? 'space-between' : 'flex-start'}
      flex={1}
      // h="full"
    >
      <Form>
        <Form.Item
          control={control}
          name="text"
          rules={{
            validate: async (text) => {
              if (!text) {
                return true;
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
          helpText={(value) => (
            <NameServiceResolver
              name={value}
              onChange={onNameServiceChange}
              disableBTC
            />
          )}
        >
          <Form.Textarea placeholder={placeholder} h="48" />
        </Form.Item>
        {!(platformEnv.isExtension || platformEnv.isWeb) && showPasteButton && (
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

        {showSubmitButton ? (
          <Button
            isDisabled={submitDisabled || disableSubmitBtn}
            type="primary"
            size={isVerticalLayout ? 'xl' : 'lg'}
            onPromise={handleSubmit((values) => {
              if (!disableSubmitBtn && address) {
                values.text = address;
              }
              onSubmit(values);
            })}
          >
            {intl.formatMessage({ id: 'action__confirm' })}
          </Button>
        ) : null}
      </Form>
      {children}
    </Box>
  );
}

function OnboardingAddExistingWallet() {
  const onboardingDone = useOnboardingDone();
  const navigation = useNavigation();

  const context = useOnboardingContext();
  const forceVisibleUnfocused = context?.forceVisibleUnfocused;

  const onMultipleResults = useCallback(
    (p: IAddImportedOrWatchingAccountModalParams) => {
      debugLogger.onBoarding.info(
        'OnboardingAddExistingWallet > onMultipleResults',
        p.checkResults,
      );
      forceVisibleUnfocused?.();
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.CreateWallet,
        params: {
          screen: CreateWalletModalRoutes.AddImportedOrWatchingAccountModal,
          params: p,
        },
      });
    },
    [forceVisibleUnfocused, navigation],
  );

  const onAddWatchingDone = useCallback(() => {
    debugLogger.onBoarding.info(
      'OnboardingAddExistingWallet > onAddWatchingDone',
    );

    onboardingDone();
  }, [onboardingDone]);

  const onAddMnemonicAuth = useCallback(
    (p: IAppWalletDoneModalParams) => {
      debugLogger.onBoarding.info(
        'OnboardingAddExistingWallet > onAddMnemonicAuth',
      );
      // forceVisibleUnfocused?.();
      navigation.navigate(RootRoutes.Onboarding, {
        screen: EOnboardingRoutes.SetPassword,
        params: {
          mnemonic: p.mnemonic,
        },
      });
    },
    [navigation],
  );

  const onAddImportedAuth = useCallback(
    (p: IAddImportedAccountDoneModalParams) => {
      debugLogger.onBoarding.info(
        'OnboardingAddExistingWallet > onAddImportedAuth',
        {
          networkId: p.networkId,
          name: p.name,
        },
      );
      forceVisibleUnfocused?.();
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.CreateWallet,
        params: {
          screen: CreateWalletModalRoutes.AddImportedAccountDoneModal,
          params: p,
        },
      });
    },
    [forceVisibleUnfocused, navigation],
  );

  const viewProps = useAddExistingWallet({
    onMultipleResults,
    onAddMnemonicAuth,
    onAddWatchingDone,
    onAddImportedAuth,
  });
  return <AddExistingWalletView {...viewProps} showSubmitButton />;
}

function OneKeyLiteRecoveryButton() {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const startRestorePinVerifyModal = useCallback(() => {
    navigation.navigate(
      CreateWalletModalRoutes.OnekeyLiteRestorePinCodeVerifyModal,
    );
  }, [navigation]);

  return (
    <Button
      size="xl"
      type="plain"
      rightIconName="ChevronRightOutline"
      iconSize={16}
      onPress={() => startRestorePinVerifyModal()}
    >
      {intl.formatMessage({ id: 'action__restore_with_onekey_lite' })}
    </Button>
  );
}

// AddExistingWalletInModal
const AddExistingWallet = () => {
  const navigation = useNavigation<NavigationProps['navigation']>();
  const onboardingDone = useOnboardingDone();

  const onMultipleResults = useCallback(
    (p: IAddImportedOrWatchingAccountModalParams) => {
      // Multiple choices.
      navigation.navigate(
        CreateWalletModalRoutes.AddImportedOrWatchingAccountModal,
        p,
      );
    },
    [navigation],
  );
  const onAddMnemonicAuth = useCallback(
    (p: IAppWalletDoneModalParams) => {
      navigation.navigate(CreateWalletModalRoutes.AppWalletDoneModal, p);
    },
    [navigation],
  );

  const onAddWatchingDone = useCallback(() => {
    onboardingDone();
  }, [onboardingDone]);

  const onAddImportedAuth = useCallback(
    (p: IAddImportedAccountDoneModalParams) => {
      navigation.navigate(
        CreateWalletModalRoutes.AddImportedAccountDoneModal,
        p,
      );
    },
    [navigation],
  );

  const viewProps = useAddExistingWallet({
    onMultipleResults,
    onAddMnemonicAuth,
    onAddWatchingDone,
    onAddImportedAuth,
  });

  const { intl, onSubmit, handleSubmit, submitDisabled, mode } = viewProps;

  const liteRecoveryButton = useMemo(
    () =>
      (supportedNFC || platformEnv.isDev) && mode === 'all' ? (
        <Box>
          <Box flex={1} />
          <Box h={2} />
          <OneKeyLiteRecoveryButton />
        </Box>
      ) : null,
    [mode],
  );

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
      <AddExistingWalletView {...viewProps} showPasteButton>
        {liteRecoveryButton}
      </AddExistingWalletView>
    </Modal>
  );
};

export default AddExistingWallet;
export { OnboardingAddExistingWallet };
