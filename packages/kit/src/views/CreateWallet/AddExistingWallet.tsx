import { useCallback, useEffect, useMemo } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
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
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import { getClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import { UserInputCategory } from '@onekeyhq/engine/src/types/credential';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import NameServiceResolver, {
  useNameServiceStatus,
} from '@onekeyhq/kit/src/components/NameServiceResolver';
import { useGeneral, useRuntime } from '@onekeyhq/kit/src/hooks/redux';
import type {
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
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import supportedNFC from '@onekeyhq/shared/src/detector/nfc';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useFormOnChangeDebounced } from '../../hooks/useFormOnChangeDebounced';
import { useOnboardingDone } from '../../hooks/useOnboardingRequired';
import { useWalletName } from '../../hooks/useWalletName';
import { wait } from '../../utils/helper';
import { useOnboardingContext } from '../Onboarding/OnboardingContext';
import { EOnboardingRoutes } from '../Onboarding/routes/enums';

import type { RouteProp } from '@react-navigation/core';

type NavigationProps = ModalScreenProps<CreateWalletRoutesParams>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type RouteProps = RouteProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.AddExistingWalletModal
>;

type AddExistingWalletValues = { text: string; defaultName?: string };

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
  const onboardingDone = useOnboardingDone();

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

  const navigation = useNavigation();
  const onFailure = useCallback(() => {
    const stack = navigation.getParent() || navigation;
    if (stack.canGoBack()) {
      stack.goBack();
    }
  }, [navigation]);

  const onSubmit = useCallback(
    async (values: AddExistingWalletValues) => {
      const { text, defaultName } = values;
      if (!text) {
        return;
      }
      const results = (
        await backgroundApiProxy.validator.validateCreateInput({
          input: text,
          onlyFor: inputCategory,
        })
      ).filter(({ category }) => category !== UserInputCategory.ADDRESS);

      if (results.length === 0) {
        // Check failed. Shouldn't happen.
        return;
      }

      if (results.length > 1) {
        onMultipleResults({
          defaultName,
          text,
          checkResults: results,
          onSuccess() {
            toast.show(
              {
                title: intl.formatMessage({ id: 'msg__account_imported' }),
              },
              {},
            );
            onboardingDone({ showOnBoardingLoading: true });
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
            toast.show(
              {
                title: intl.formatMessage({ id: 'msg__account_imported' }),
              },
              {},
            );
            onboardingDone({ showOnBoardingLoading: true });
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
          toast.show(
            {
              title: intl.formatMessage({ id: 'msg__account_imported' }),
            },
            {},
          );
          onAddWatchingDone();
          onboardingDone({ showOnBoardingLoading: true });
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
            toast.show(
              {
                title: intl.formatMessage({ id: 'msg__account_imported' }),
              },
              {},
            );
            onboardingDone({ showOnBoardingLoading: true });
          },
          onFailure,
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
      onboardingDone,
      onFailure,
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
    onNameServiceChange?: ReturnType<typeof useNameServiceStatus>['onChange'];
    nameServiceAddress?: ReturnType<typeof useNameServiceStatus>['address'];
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
    mode,
    children,
    showSubmitButton,
    showPasteButton,
    onNameServiceChange,
    nameServiceAddress,
  } = props;

  const {
    onChange: onNameServiceStatusChange,
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
            validate: async (t) => {
              const text = nameServiceAddress || address || t;
              if (!text) {
                return true;
              }
              if (
                (
                  await backgroundApiProxy.validator.validateCreateInput({
                    input: text,
                    onlyFor: inputCategory,
                  })
                ).filter(
                  ({ category }) => category !== UserInputCategory.ADDRESS,
                ).length > 0
              ) {
                return true;
              }
              // Special treatment for BTC address.
              try {
                await backgroundApiProxy.validator.validateAddress(
                  OnekeyNetwork.btc,
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
              disable={mode === 'imported'}
              onChange={onNameServiceChange || onNameServiceStatusChange}
              disableBTC
            />
          )}
        >
          <Form.Textarea
            placeholder={placeholder}
            h="48"
            trimValue={!['all', 'mnemonic'].includes(mode)}
          />
        </Form.Item>
        {!(platformEnv.isExtension || platformEnv.isWeb) && showPasteButton && (
          <Center>
            <Button
              size="xl"
              type="plain"
              leftIconName="Square2StackMini"
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
            onPromise={handleSubmit(async (values) => {
              if (!disableSubmitBtn && address) {
                values.text = address;
              }
              await onSubmit(values);
              await wait(600);
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
  }, []);

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
  const route = useRoute();
  // @ts-expect-error
  const walletName = useWalletName({ wallet: route?.params?.wallet });

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
    // noop
  }, []);

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

  const {
    onChange: onNameServiceChange,
    disableSubmitBtn,
    address,
    name,
  } = useNameServiceStatus();
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
      headerDescription={walletName}
      primaryActionTranslationId="action__import"
      primaryActionProps={{
        onPromise: handleSubmit((values) => {
          if (!disableSubmitBtn && address) {
            values.defaultName = name;
            values.text = address;
          }
          return onSubmit(values);
        }),
        isDisabled: submitDisabled || disableSubmitBtn,
      }}
      hideSecondaryAction
    >
      <AddExistingWalletView
        {...viewProps}
        showPasteButton
        showSubmitButton={false}
        nameServiceAddress={address}
        onNameServiceChange={onNameServiceChange}
      >
        {liteRecoveryButton}
      </AddExistingWalletView>
    </Modal>
  );
};

export default AddExistingWallet;
export { OnboardingAddExistingWallet };
