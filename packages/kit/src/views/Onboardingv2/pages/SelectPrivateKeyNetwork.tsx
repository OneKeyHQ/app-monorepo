import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type {
  IFormMode,
  IReValidateMode,
  IXStackProps,
  UseFormReturn,
} from '@onekeyhq/components';
import {
  Alert,
  AnimatePresence,
  Button,
  Dialog,
  Form,
  HeightTransition,
  Icon,
  Input,
  Label,
  Page,
  Popover,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
  useForm,
  useFormWatch,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import useConfigurableChainSelector from '@onekeyhq/kit/src/views/ChainSelector/hooks/useChainSelector';
import type {
  IAccountDeriveTypes,
  IValidateGeneralInputParams,
} from '@onekeyhq/kit-bg/src/vaults/types';
import {
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import {
  IMPL_COSMOS,
  IMPL_DOT,
  IMPL_EVM,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  EOnboardingPagesV2,
  IOnboardingParamListV2,
} from '@onekeyhq/shared/src/routes';
import type {
  IDetectedNetwork,
  IDetectedNetworkGroupItem,
} from '@onekeyhq/shared/src/utils/networkDetectUtils';
import networkDetectUtils from '@onekeyhq/shared/src/utils/networkDetectUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IGeneralInputValidation } from '@onekeyhq/shared/types/address';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { DeriveTypeSelectorFormInput } from '../../../components/AccountSelector/DeriveTypeSelectorTrigger';
import { NetworkAvatar } from '../../../components/NetworkAvatar';
import { MAX_LENGTH_ACCOUNT_NAME } from '../../../components/RenameDialog/renameConsts';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useAppRoute } from '../../../hooks/useAppRoute';
import { useUserWalletProfile } from '../../../hooks/useUserWalletProfile';
import { useAccountSelectorActions } from '../../../states/jotai/contexts/accountSelector';
import { toastSuccessWhenImportAddressOrPrivateKey } from '../../../utils/toastExistingWalletSwitch';
import { OnboardingLayout } from '../components/OnboardingLayout';

type IFormValues = {
  // networkId?: string;
  deriveType?: IAccountDeriveTypes;
  // publicKeyValue: string;
  // addressValue: IAddressInputValue;
  accountName?: string;
};

function NetworkAvatars({
  networks,
  showMore,
  ...rest
}: {
  networks: IDetectedNetwork[];
  showMore?: boolean;
} & IXStackProps) {
  return (
    <XStack {...rest}>
      {networks.slice(0, 3).map((item, index) => (
        <YStack
          key={item.networkId}
          {...(index !== 0 && {
            ml: '$-2',
          })}
          borderWidth={2}
          borderColor="$bgApp"
          borderRadius="$full"
        >
          <NetworkAvatar networkId={item.networkId} size="$8" />
        </YStack>
      ))}
      {showMore ? (
        <YStack
          ml="$-2"
          borderWidth={2}
          borderColor="$bgApp"
          borderRadius="$full"
          bg="$gray4"
          w={36}
          h={36}
          alignItems="center"
          justifyContent="center"
        >
          <Icon name="DotHorOutline" color="$iconSubdued" />
        </YStack>
      ) : null}
    </XStack>
  );
}

function NetworkGroupItem({
  selectedUUID,
  onSelect,
  item,
  formView,
  invalidAlertView,
}: {
  selectedUUID: string;
  onSelect: (params: { uuid: string; networkId?: string }) => void;
  item: IDetectedNetworkGroupItem;
  formView: React.ReactNode;
  invalidAlertView: React.ReactNode;
}) {
  const intl = useIntl();
  const media = useMedia();
  const [selectedNetworkId, setSelectedNetworkId] = useState<
    string | undefined
  >(item?.networks?.[0]?.networkId);
  const selectedNetworkIdRef = useRef<string | undefined>(undefined);
  selectedNetworkIdRef.current = selectedNetworkId;
  const selectedNetwork = useMemo<IDetectedNetwork>(() => {
    return (
      item?.networks?.find(
        (network) => network?.networkId === selectedNetworkId,
      ) || item?.networks?.[0]
    );
  }, [item.networks, selectedNetworkId]);

  const displayName = useMemo(() => {
    // For multi-network groups, display "{impl}-compatible networks"
    if (item.networks.length > 1) {
      let implName = '';
      switch (item.impl) {
        case IMPL_EVM:
          implName = 'EVM';
          break;
        case IMPL_COSMOS:
          implName = 'Cosmos';
          break;
        case IMPL_DOT:
          implName = 'Polkadot';
          break;
        default:
          // For other impls, use the first network name
          return selectedNetwork?.name;
      }
      return intl.formatMessage(
        { id: ETranslations.str_compatible_networks },
        { name: implName },
      );
    }
    return selectedNetwork?.name;
  }, [item.impl, item.networks.length, selectedNetwork?.name, intl]);

  // Render network selection popover content
  const renderNetworkPopoverContent = useCallback(
    ({
      closePopover,
      interactive = false,
    }: {
      closePopover?: () => void;
      interactive?: boolean;
    }) => {
      return (
        <ScrollView
          contentContainerStyle={{
            gap: '$2',
            p: '$3',
            $gtMd: {
              maxHeight: '400px',
            },
          }}
        >
          {media.gtMd ? (
            <SizableText size="$bodyMd" color="$textSubdued" pb="$2">
              {intl.formatMessage(
                { id: ETranslations.supported_count_networks },
                { count: item.networks.length },
              )}
            </SizableText>
          ) : null}
          <XStack flexWrap="wrap" w="100%" mb="$-4">
            {item.networks.map((network) => (
              <YStack
                key={network.networkId}
                w="25%"
                gap="$2"
                alignItems="center"
                px="$2"
                py="$3"
                {...(interactive && {
                  onPress: () => {
                    setSelectedNetworkId(network.networkId);
                    selectedNetworkIdRef.current = network.networkId;
                    onSelect({
                      uuid: item.uuid,
                      networkId: network.networkId,
                    });
                    closePopover?.();
                  },
                  hoverStyle: {
                    bg: '$bgHover',
                  },
                  pressStyle: {
                    bg: '$bgActive',
                  },
                  borderRadius: '$2',
                  borderCurve: 'continuous',
                  userSelect: 'none',
                })}
              >
                <NetworkAvatar networkId={network.networkId} size="$8" />
                <SizableText
                  size="$bodySm"
                  textAlign="center"
                  color="$textSubdued"
                  numberOfLines={1}
                >
                  {network.name}
                </SizableText>
              </YStack>
            ))}
          </XStack>
        </ScrollView>
      );
    },
    [item.networks, item.uuid, media.gtMd, intl, onSelect],
  );

  const shouldShowExtraPanel = useMemo(() => {
    if (selectedUUID === item.uuid) {
      if (formView || invalidAlertView) {
        return true;
      }
      if (item.networks.length > 1 && item.impl !== IMPL_EVM) {
        return true;
      }
    }
    return false;
  }, [
    selectedUUID,
    item.uuid,
    item.networks.length,
    item.impl,
    formView,
    invalidAlertView,
  ]);

  const subNetworkSelectorView = useMemo(() => {
    if (!item.networks.length || item.networks.length <= 1) {
      return null;
    }
    return (
      <>
        <Label>
          {intl.formatMessage({ id: ETranslations.selected_network })}
        </Label>
        <Popover
          sheetProps={{
            snapPoints: [80],
            snapPointsMode: 'percent',
          }}
          title={intl.formatMessage(
            { id: ETranslations.supported_count_networks },
            { count: item.networks.length },
          )}
          placement="bottom"
          renderTrigger={
            <XStack
              gap="$2"
              alignItems="center"
              p="$3"
              py="$2.5"
              bg="$bg"
              borderWidth={1}
              borderColor="$borderStrong"
              borderRadius="$3"
              borderCurve="continuous"
              hoverStyle={{
                bg: '$bgHover',
              }}
              userSelect="none"
            >
              <NetworkAvatar networkId={selectedNetwork?.networkId} size="$5" />
              <SizableText flex={1}>{selectedNetwork?.name}</SizableText>
              <Icon
                name="ChevronDownSmallOutline"
                color="$iconSubdued"
                size="$5"
              />
            </XStack>
          }
          renderContent={({ closePopover }) =>
            renderNetworkPopoverContent({
              closePopover,
              interactive: true,
            })
          }
        />
      </>
    );
  }, [
    intl,
    item.networks.length,
    renderNetworkPopoverContent,
    selectedNetwork?.name,
    selectedNetwork?.networkId,
  ]);

  return (
    <YStack borderRadius="$5" borderCurve="continuous" bg="$neutral3">
      <ListItem
        key={item.uuid}
        gap="$3"
        bg="$bg"
        borderWidth={1}
        borderColor="$borderSubdued"
        borderRadius="$5"
        borderCurve="continuous"
        p="$3"
        pl="$5"
        m="$0"
        userSelect="none"
        pressStyle={undefined}
        onPress={() => {
          onSelect({
            uuid: item.uuid,
            networkId: selectedNetworkIdRef.current,
          });
        }}
        {...(selectedUUID === item.uuid && {
          borderColor: '$borderActive',
          hoverStyle: undefined,
        })}
      >
        <ListItem.Text primary={displayName} flex={1} />
        {item.networks.length > 1 ? (
          <Popover
            title={intl.formatMessage(
              { id: ETranslations.supported_count_networks },
              { count: item.networks.length },
            )}
            sheetProps={{
              snapPoints: [80],
              snapPointsMode: 'percent',
            }}
            placement="bottom"
            renderTrigger={
              <NetworkAvatars
                networks={item.networks}
                showMore
                p="$1"
                m="$-1"
                hoverStyle={{
                  bg: '$bgHover',
                }}
                borderRadius="$full"
              />
            }
            renderContent={({ closePopover }) =>
              renderNetworkPopoverContent({ interactive: false, closePopover })
            }
          />
        ) : (
          <NetworkAvatars networks={item.networks} />
        )}
      </ListItem>
      <HeightTransition initialHeight={0}>
        <AnimatePresence>
          {shouldShowExtraPanel ? (
            <YStack
              animation="quick"
              enterStyle={{
                opacity: 0,
                filter: 'blur(4px)',
              }}
              exitStyle={{
                opacity: 0,
                filter: 'blur(4px)',
              }}
              p="$5"
              gap="$1"
            >
              {subNetworkSelectorView}
              {formView}
              {invalidAlertView}
            </YStack>
          ) : null}
        </AnimatePresence>
      </HeightTransition>
    </YStack>
  );
}

function SelectPrivateKeyNetworkView() {
  const routeParams = useAppRoute<
    IOnboardingParamListV2,
    EOnboardingPagesV2.SelectPrivateKeyNetwork
  >().params;
  const input = routeParams?.input;
  const detectedNetworks = useMemo(
    () => routeParams?.detectedNetworks || [],
    [routeParams?.detectedNetworks],
  );
  const isDetectingNetworks = false;
  const importType = routeParams?.importType;

  const intl = useIntl();

  const [selectedUUID, setSelectedUUID] = useState('');
  const openChainSelector = useConfigurableChainSelector();
  const [manualSelectedNetwork, setManualSelectedNetwork] = useState<
    IDetectedNetworkGroupItem | undefined
  >();
  const [selectedNetworkId, setSelectedNetworkId] = useState<
    string | undefined
  >(undefined);

  const handleSelectGroupItem = useCallback(
    (params: { uuid: string; networkId?: string } | undefined) => {
      setSelectedUUID(params?.uuid || '');
      setSelectedNetworkId(params?.networkId || undefined);
    },
    [],
  );

  useEffect(() => {
    setSelectedUUID(detectedNetworks?.[0]?.uuid || '');
    setSelectedNetworkId(
      detectedNetworks?.[0]?.networks?.[0]?.networkId || undefined,
    );
  }, [detectedNetworks]);

  const handleShowMoreNetworks = useCallback(() => {
    openChainSelector({
      title: intl.formatMessage({ id: ETranslations.global_select_network }),
      excludeAllNetworkItem: true,
      onSelect: (network) => {
        const item: IDetectedNetworkGroupItem = {
          uuid: network.id,
          impl: network.impl,
          networks: [
            {
              networkId: network.id,
              name: network.name,
              shortname: network.shortname,
              impl: network.impl,
            },
          ],
        };
        setManualSelectedNetwork(item);
        handleSelectGroupItem({ uuid: item.uuid, networkId: network.id });
      },
    });
  }, [handleSelectGroupItem, intl, openChainSelector]);

  const isValidatingRef = useRef<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const actions = useAccountSelectorActions();
  const navigation = useAppNavigation();
  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();

  const walletId = useMemo(() => {
    return importType === 'privateKey'
      ? WALLET_TYPE_IMPORTED
      : WALLET_TYPE_WATCHING;
  }, [importType]);

  const handleConfirm = useCallback(
    async (form: UseFormReturn<IFormValues, any, undefined>) => {
      try {
        if (isValidatingRef.current) {
          return;
        }
        if (!selectedNetworkId) {
          return;
        }
        setIsSubmitting(true);
        await timerUtils.wait(300);
        const values = form.getValues();
        let accountId = '';
        let isOverrideAccounts = false;
        if (importType === 'privateKey') {
          const r = await backgroundApiProxy.serviceAccount.addImportedAccount({
            input,
            deriveType: values.deriveType,
            networkId: selectedNetworkId,
            name: values.accountName,
            shouldCheckDuplicateName: true,
          });
          accountId = r?.accounts?.[0]?.id;
          isOverrideAccounts = r?.isOverrideAccounts;
        }
        if (importType === 'address') {
          const r = await backgroundApiProxy.serviceAccount.addWatchingAccount({
            input,
            // deriveType: values.deriveType,
            networkId: selectedNetworkId,
            name: values.accountName,
            shouldCheckDuplicateName: true,
          });
          accountId = r?.accounts?.[0]?.id;
          isOverrideAccounts = r?.isOverrideAccounts;
        }
        if (importType === 'publicKey') {
          const r = await backgroundApiProxy.serviceAccount.addWatchingAccount({
            input,
            deriveType: values.deriveType,
            networkId: selectedNetworkId,
            name: values.accountName,
            shouldCheckDuplicateName: true,
          });
          accountId = r?.accounts?.[0]?.id;
          isOverrideAccounts = r?.isOverrideAccounts;
        }

        if (accountId) {
          toastSuccessWhenImportAddressOrPrivateKey({
            isOverrideAccounts,
            accountId,
          });

          void actions.current.updateSelectedAccountForSingletonAccount({
            num: 0,
            networkId: selectedNetworkId,
            walletId,
            othersWalletAccountId: accountId,
          });
          navigation.popStack();

          if (importType === 'privateKey') {
            defaultLogger.account.wallet.walletAdded({
              status: 'success',
              addMethod: 'ImportWallet',
              details: {
                importType: 'privateKey',
              },
              isSoftwareWalletOnlyUser,
            });
          }
        }
      } finally {
        await timerUtils.wait(300);
        setIsSubmitting(false);
      }
    },
    [
      actions,
      input,
      isSoftwareWalletOnlyUser,
      navigation,
      selectedNetworkId,
      walletId,
      importType,
    ],
  );

  const formOptions = useMemo(
    () => ({
      values: {
        deriveType: undefined,
        accountName: '',
      },
      mode: 'onChange' as IFormMode,
      reValidateMode: 'onBlur' as IReValidateMode,
      onSubmit: handleConfirm,
    }),
    [handleConfirm],
  );
  const form = useForm<IFormValues>(formOptions);
  const accountName = useFormWatch({
    control: form.control,
    name: 'accountName',
  });
  const accountNameDebounced = useDebounce(accountName?.trim() || '', 600);
  const invalidMessage = intl.formatMessage({
    id: ETranslations.network_does_not_match_the_private_key,
  });

  const [validateResult, setValidateResult] = useState<
    IGeneralInputValidation | undefined
  >();

  const invalidAlertView = useMemo(() => {
    return validateResult && !validateResult?.isValid && input ? (
      <Alert icon="ErrorOutline" title={invalidMessage} type="danger" />
    ) : null;
  }, [input, invalidMessage, validateResult]);

  const validateFn = useCallback(async () => {
    if (accountNameDebounced) {
      try {
        await backgroundApiProxy.serviceAccount.ensureAccountNameNotDuplicate({
          name: accountNameDebounced,
          walletId,
        });
        form.clearErrors('accountName');
      } catch (error) {
        form.setError('accountName', {
          message: (error as Error)?.message,
        });
      }
    } else {
      form.clearErrors('accountName');
    }

    form.setValue('deriveType', undefined);
    if (input && selectedNetworkId) {
      if (importType === 'privateKey' || importType === 'publicKey') {
        try {
          const result =
            await backgroundApiProxy.serviceAccount.validateGeneralInputOfImporting(
              importType === 'privateKey'
                ? {
                    validateXprvt: true,
                    validatePrivateKey: true,
                    input,
                    networkId: selectedNetworkId,
                  }
                : {
                    validateXpub: true,
                    input,
                    networkId: selectedNetworkId,
                  },
            );
          setValidateResult(result);
          console.log('validateGeneralInputOfImporting result', result);
          // TODO: need to replaced by https://github.com/mattermost/react-native-paste-input
        } catch (error) {
          setValidateResult({
            isValid: false,
          });
        }
      } else {
        setValidateResult({
          isValid: true,
        });
      }
    } else {
      setValidateResult(undefined);
    }
  }, [
    accountNameDebounced,
    form,
    importType,
    input,
    selectedNetworkId,
    walletId,
  ]);

  useEffect(() => {
    void (async () => {
      try {
        isValidatingRef.current = true;
        setIsValidating(true);
        await timerUtils.wait(300);
        await validateFn();
      } finally {
        await timerUtils.wait(300);
        setIsValidating(false);
        isValidatingRef.current = false;
      }
    })();
  }, [validateFn]);

  const submitButtonLoading = useMemo(() => {
    return (
      isSubmitting ||
      isDetectingNetworks ||
      isValidating ||
      form?.formState?.isSubmitting ||
      form?.formState?.isLoading ||
      form?.formState?.isValidating
    );
  }, [
    isSubmitting,
    isDetectingNetworks,
    isValidating,
    form?.formState?.isSubmitting,
    form?.formState?.isLoading,
    form?.formState?.isValidating,
  ]);

  const submitButtonDisabled = useMemo(() => {
    return (
      submitButtonLoading ||
      !selectedNetworkId ||
      !validateResult?.isValid ||
      !!Object.values(form.formState.errors).length
    );
  }, [
    submitButtonLoading,
    selectedNetworkId,
    validateResult?.isValid,
    form.formState.errors,
  ]);

  const formView = useMemo(() => {
    const shouldShowDeriveTypeSelector =
      validateResult?.deriveInfoItems &&
      validateResult?.deriveInfoItems.length > 0;

    // const shouldShowAccountNameInput = selectedNetworkId && validateResult?.isValid;
    const shouldShowAccountNameInput = false;

    if (!shouldShowDeriveTypeSelector && !shouldShowAccountNameInput) {
      return null;
    }

    return (
      <Form form={form}>
        {shouldShowDeriveTypeSelector ? (
          <Form.Field
            label={intl.formatMessage({
              id: ETranslations.derivation_path,
            })}
            name="deriveType"
          >
            <DeriveTypeSelectorFormInput
              networkId={selectedNetworkId || ''}
              enabledItems={validateResult?.deriveInfoItems || []}
              undefinedResultIfReRun={false}
              renderTrigger={({ label, onPress }) => (
                <Stack
                  testID="wallet-derivation-path-selector-trigger"
                  userSelect="none"
                  flexDirection="row"
                  px="$3.5"
                  py="$2.5"
                  borderWidth={1}
                  borderColor="$borderStrong"
                  borderRadius="$3"
                  $gtMd={{
                    px: '$3',
                    py: '$1.5',
                    borderRadius: '$2',
                  }}
                  borderCurve="continuous"
                  hoverStyle={{
                    bg: '$bgHover',
                  }}
                  pressStyle={{
                    bg: '$bgActive',
                  }}
                  onPress={onPress}
                >
                  <SizableText flex={1}>{label}</SizableText>
                  <Icon
                    name="ChevronDownSmallOutline"
                    color="$iconSubdued"
                    mr="$-0.5"
                  />
                </Stack>
              )}
            />
          </Form.Field>
        ) : null}

        {shouldShowAccountNameInput ? (
          <Form.Field
            label={intl.formatMessage({
              id: ETranslations.form_enter_account_name,
            })}
            name="accountName"
          >
            <Input
              maxLength={MAX_LENGTH_ACCOUNT_NAME}
              placeholder={intl.formatMessage({
                id: ETranslations.form_enter_account_name_placeholder,
              })}
            />
          </Form.Field>
        ) : null}
      </Form>
    );
  }, [form, intl, selectedNetworkId, validateResult?.deriveInfoItems]);

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header
          title={intl.formatMessage({
            id: ETranslations.global_select_network,
          })}
        />
        <OnboardingLayout.Body constrained={false}>
          <OnboardingLayout.ConstrainedContent
            $gtMd={{
              py: '$6',
            }}
          >
            <YStack gap="$2.5">
              {detectedNetworks && detectedNetworks.length === 0 ? (
                <YStack gap="$5">
                  <SizableText size="$bodyLg">
                    {intl.formatMessage({
                      id: ETranslations.havent_found_network_desc,
                    })}
                  </SizableText>
                  <ListItem
                    onPress={handleShowMoreNetworks}
                    gap="$3"
                    bg="$bg"
                    borderWidth={1}
                    borderColor="$borderSubdued"
                    borderCurve="continuous"
                    p="$3"
                    pr="$5"
                    m="$0"
                    userSelect="none"
                  >
                    {manualSelectedNetwork ? (
                      <NetworkAvatar
                        networkId={manualSelectedNetwork.networks[0]?.networkId}
                        size="$10"
                      />
                    ) : (
                      <YStack p="$2" borderRadius="$full" bg="$bgStrong">
                        <Icon name="PlusLargeOutline" />
                      </YStack>
                    )}
                    <ListItem.Text
                      flex={1}
                      primary={
                        manualSelectedNetwork
                          ? manualSelectedNetwork.networks[0]?.name
                          : intl.formatMessage({
                              id: ETranslations.global_select_network,
                            })
                      }
                    />
                    <Icon
                      name="ChevronDownSmallSolid"
                      color="$iconSubdued"
                      size="$5"
                    />
                  </ListItem>
                  {invalidAlertView}
                  {formView}
                </YStack>
              ) : (
                <>
                  {detectedNetworks?.map((network) => (
                    <NetworkGroupItem
                      key={network.uuid}
                      selectedUUID={selectedUUID}
                      onSelect={handleSelectGroupItem}
                      item={network}
                      formView={formView}
                      invalidAlertView={invalidAlertView}
                    />
                  ))}
                  {manualSelectedNetwork ? (
                    <NetworkGroupItem
                      key={manualSelectedNetwork.uuid}
                      selectedUUID={selectedUUID}
                      onSelect={handleSelectGroupItem}
                      item={manualSelectedNetwork}
                      formView={formView}
                      invalidAlertView={invalidAlertView}
                    />
                  ) : null}
                  {detectedNetworks && detectedNetworks.length > 0 ? (
                    <XStack gap="$1" pt="$5" justifyContent="center">
                      <SizableText size="$bodyMd" color="$textSubdued">
                        {intl.formatMessage({
                          id: ETranslations.cant_find_network_question,
                        })}
                      </SizableText>
                      <Button
                        variant="tertiary"
                        size="small"
                        onPress={handleShowMoreNetworks}
                      >
                        {intl.formatMessage({
                          id: ETranslations.show_more_networks,
                        })}
                      </Button>
                    </XStack>
                  ) : null}
                </>
              )}
            </YStack>
          </OnboardingLayout.ConstrainedContent>
        </OnboardingLayout.Body>
        <OnboardingLayout.Footer>
          <Button
            w="100%"
            maxWidth={400}
            disabled={submitButtonDisabled}
            loading={submitButtonLoading}
            size="large"
            variant="primary"
            onPress={async () => {
              // Dialog.debugMessage({
              //   debugMessage: {
              //     selectedUUID,
              //     selectedNetworkId,
              //   },
              // });
              await form?.submit?.();
            }}
          >
            {intl.formatMessage({ id: ETranslations.global_confirm })}
          </Button>
        </OnboardingLayout.Footer>
      </OnboardingLayout>
    </Page>
  );
}

export default function SelectPrivateKeyNetwork() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[0]}
    >
      <SelectPrivateKeyNetworkView />
    </AccountSelectorProviderMirror>
  );
}
