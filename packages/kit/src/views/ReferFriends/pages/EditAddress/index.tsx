import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type {
  IFormMode,
  IReValidateMode,
  UseFormReturn,
} from '@onekeyhq/components';
import {
  Form,
  Page,
  SizableText,
  YStack,
  useForm,
  useFormWatch,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  AccountSelectorProviderMirror,
  ControlledNetworkSelectorTrigger,
} from '@onekeyhq/kit/src/components/AccountSelector';
import type { IAddressInputValue } from '@onekeyhq/kit/src/components/AddressInput';
import {
  AddressInput,
  createValidateAddressRule,
} from '@onekeyhq/kit/src/components/AddressInput';
import { AddressInputContext } from '@onekeyhq/kit/src/components/AddressInput/AddressInputContext';
import { renderAddressInputHyperlinkText } from '@onekeyhq/kit/src/components/AddressInput/AddressInputHyperlinkText';
import { renderAddressSecurityHeaderRightButton } from '@onekeyhq/kit/src/components/AddressInput/AddressSecurityHeaderRightButton';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EPrimeEmailOTPScene } from '@onekeyhq/shared/src/consts/primeConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalReferFriendsRoutes,
  IModalReferFriendsParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { ReferFriendsPageContainer } from '../../components';

import type { RouteProp } from '@react-navigation/native';

type IFormValues = {
  networkId: string;
  to: IAddressInputValue;
};

function BasicEditAddress() {
  const route =
    useRoute<
      RouteProp<
        IModalReferFriendsParamList,
        EModalReferFriendsRoutes.EditAddress
      >
    >();
  const onAddressAdded = route.params?.onAddressAdded;
  const hideAddressBook = route.params?.hideAddressBook ?? false;
  const enableAllowListValidation =
    route.params?.enableAllowListValidation ?? true;
  const intl = useIntl();
  const navigation = useAppNavigation();
  const enabledNetworks = useMemo(
    () => route.params?.enabledNetworks || [],
    [route.params?.enabledNetworks],
  );

  const accountId = route.params?.accountId ?? '';

  const { sendEmailOTP } = useOneKeyAuth();
  const actions = useAccountSelectorActions();

  // Sync account selection from home scene to make wallet active
  useEffect(() => {
    void actions.current.syncFromScene({
      from: {
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
        sceneNum: 0,
      },
      num: 0,
    });
  }, [actions]);

  const { result: networksResp } = usePromiseResult(
    async () => {
      const resp =
        await backgroundApiProxy.serviceNetwork.getPublicKeyExportOrWatchingAccountEnabledNetworks();
      const networkIds = resp
        .filter((o) => enabledNetworks.includes(o.network.id))
        .map((o) => o.network.id);
      const publicKeyExportEnabledNetworkIds = resp
        .filter(
          (o) =>
            o.publicKeyExportEnabled && enabledNetworks.includes(o.network.id),
        )
        .map((t) => t.network.id);

      const watchingAccountEnabledNetworkIds = resp
        .filter(
          (o) =>
            o.watchingAccountEnabled && enabledNetworks.includes(o.network.id),
        )
        .map((t) => t.network.id);
      return {
        networkIds,
        publicKeyExportEnabled: new Set(publicKeyExportEnabledNetworkIds),
        watchingAccountEnabled: new Set(watchingAccountEnabledNetworkIds),
      };
    },
    [enabledNetworks],
    {
      initResult: {
        networkIds: [],
        publicKeyExportEnabled: new Set([]),
        watchingAccountEnabled: new Set([]),
      },
    },
  );

  const onSubmitRef = useRef<
    ((formContext: UseFormReturn<IFormValues>) => Promise<void>) | null
  >(null);
  const formOptions = useMemo(
    () => ({
      values: {
        networkId: enabledNetworks[0],
        deriveType: undefined,
        to: { raw: route?.params?.address || '', resolved: undefined },
      },
      mode: 'onChange' as IFormMode,
      reValidateMode: 'onBlur' as IReValidateMode,
      onSubmit: async (formContext: UseFormReturn<IFormValues>) => {
        await onSubmitRef.current?.(formContext);
      },
    }),
    [enabledNetworks, route?.params?.address],
  );
  const form = useForm<IFormValues>(formOptions);

  const { control } = form;
  const networkIdValue = useFormWatch({ control, name: 'networkId' });
  const addressValue = useFormWatch({ control, name: 'to' });
  const isEnable = useMemo(() => {
    // filter out error parameters from different segments.
    const errors = Object.values(form.formState.errors);
    if (errors.length) {
      return false;
    }
    return !addressValue.pending && form.formState.isValid;
  }, [addressValue.pending, form.formState]);

  const { result: addressBookEnabledNetworkIds } = usePromiseResult(
    async () => {
      if (hideAddressBook) {
        return [];
      }
      const networks =
        await backgroundApiProxy.serviceNetwork.getAddressBookEnabledNetworks();
      return networks.map((o) => o.id);
    },
    [hideAddressBook],
    { initResult: [] },
  );

  const addressInputAccountSelectorArgs = useMemo<{ num: number } | undefined>(
    () =>
      !hideAddressBook && addressBookEnabledNetworkIds.includes(networkIdValue)
        ? { num: 0, clearNotMatch: true }
        : undefined,
    [addressBookEnabledNetworkIds, hideAddressBook, networkIdValue],
  );

  onSubmitRef.current = useCallback(
    async (formContext: UseFormReturn<IFormValues>) => {
      const values = formContext.getValues();
      const address = values.to.resolved ?? '';
      const networkId = values.networkId ?? '';
      await sendEmailOTP({
        scene: EPrimeEmailOTPScene.UpdateRebateWithdrawAddress,
        onConfirm: async ({ code, uuid }) => {
          return backgroundApiProxy.serviceReferralCode.bindAddress({
            networkId,
            address,
            emailOTP: code,
            uuid,
          });
        },
        description: ({ userInfo }) =>
          intl.formatMessage(
            {
              id: ETranslations.referral_address_update_desc,
            },
            { mail: userInfo.displayEmail ?? '' },
          ),
      });

      navigation.pop();
      setTimeout(() => {
        onAddressAdded?.({
          address,
          networkId,
        });
      });
    },
    [navigation, onAddressAdded, sendEmailOTP, intl],
  );

  const contextValue = useMemo(
    () => ({
      name: 'to',
      networkId: networkIdValue,
      accountId,
    }),
    [accountId, networkIdValue],
  );

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.address_book_edit_address_title,
        })}
        headerRight={
          enableAllowListValidation
            ? renderAddressSecurityHeaderRightButton
            : undefined
        }
      />
      <Page.Body px="$5">
        <ReferFriendsPageContainer>
          <AddressInputContext.Provider value={contextValue}>
            <Form form={form}>
              <Form.Field
                label={intl.formatMessage({ id: ETranslations.global_network })}
                name="networkId"
              >
                <ControlledNetworkSelectorTrigger
                  networkIds={networksResp.networkIds}
                />
              </Form.Field>

              <Form.Field
                label={intl.formatMessage({ id: ETranslations.global_address })}
                name="to"
                renderErrorMessage={renderAddressInputHyperlinkText}
                rules={{
                  validate: createValidateAddressRule({
                    defaultErrorMessage: intl.formatMessage({
                      id: ETranslations.form_address_error_invalid,
                    }),
                  }),
                }}
              >
                <AddressInput
                  enableAddressBook={!hideAddressBook}
                  enableWalletName
                  enableVerifySendFundToSelf
                  enableAddressInteractionStatus
                  enableAddressContract
                  enableAllowListValidation={enableAllowListValidation}
                  accountSelector={addressInputAccountSelectorArgs}
                  // accountId={accountId}
                  networkId={networkIdValue}
                  contacts={
                    !hideAddressBook
                      ? addressBookEnabledNetworkIds.includes(networkIdValue)
                      : undefined
                  }
                  enableNameResolve
                  placeholder={intl.formatMessage({
                    id: ETranslations.form_address_placeholder,
                  })}
                  testID="refer-friends-edit-address-input"
                />
              </Form.Field>
            </Form>
          </AddressInputContext.Provider>
          <YStack gap="$5" mt="$1.5">
            <SizableText color="$textSubdued" size="$bodyMd">
              {intl.formatMessage({
                id: ETranslations.referral_reward_edit_address_desc_1,
              })}
            </SizableText>
            <SizableText color="$textSubdued" size="$bodyMd">
              {intl.formatMessage({
                id: ETranslations.referral_reward_edit_address_desc_2,
              })}
            </SizableText>
          </YStack>
        </ReferFriendsPageContainer>
      </Page.Body>
      <Page.Footer
        confirmButtonProps={{
          disabled: !isEnable,
        }}
        onConfirmText={intl.formatMessage({ id: ETranslations.action_save })}
        onConfirm={form.submit}
      />
    </Page>
  );
}

function EditAddress() {
  const route =
    useRoute<
      RouteProp<
        IModalReferFriendsParamList,
        EModalReferFriendsRoutes.EditAddress
      >
    >();
  const enabledNetworks = useMemo(
    () => route.params?.enabledNetworks || [],
    [route.params?.enabledNetworks],
  );

  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.addressInput,
        sceneUrl: '',
      }}
      enabledNum={[0]}
      availableNetworksMap={{
        0: {
          networkIds: enabledNetworks,
          defaultNetworkId: enabledNetworks[0],
        },
      }}
    >
      <BasicEditAddress />
    </AccountSelectorProviderMirror>
  );
}

export default EditAddress;
