import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  Toast,
  YStack,
  useForm,
  useFormWatch,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  AccountSelectorProviderMirror,
  ControlledNetworkSelectorTrigger,
} from '@onekeyhq/kit/src/components/AccountSelector';
import { useAccountSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorTrigger';
import type { IAddressInputValue } from '@onekeyhq/kit/src/components/AddressInput';
import {
  AddressInput,
  createValidateAddressRule,
} from '@onekeyhq/kit/src/components/AddressInput';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

type IFormValues = {
  networkId: string;
  addressValue: IAddressInputValue;
};

function BasicEditAddress() {
  const intl = useIntl();
  const media = useMedia();
  const navigation = useAppNavigation();

  const { result: networksResp } = usePromiseResult(
    async () => {
      const resp =
        await backgroundApiProxy.serviceNetwork.getPublicKeyExportOrWatchingAccountEnabledNetworks();
      const networkIds = resp.map((o) => o.network.id);
      const publicKeyExportEnabledNetworkIds = resp
        .filter((o) => o.publicKeyExportEnabled)
        .map((t) => t.network.id);

      const watchingAccountEnabledNetworkIds = resp
        .filter((o) => o.watchingAccountEnabled)
        .map((t) => t.network.id);
      return {
        networkIds,
        publicKeyExportEnabled: new Set(publicKeyExportEnabledNetworkIds),
        watchingAccountEnabled: new Set(watchingAccountEnabledNetworkIds),
      };
    },
    [],
    {
      initResult: {
        networkIds: [],
        publicKeyExportEnabled: new Set([]),
        watchingAccountEnabled: new Set([]),
      },
    },
  );

  const actions = useAccountSelectorActions();
  const {
    activeAccount: { network },
  } = useAccountSelectorTrigger({ num: 0 });

  const onSubmitRef = useRef<
    ((formContext: UseFormReturn<IFormValues>) => Promise<void>) | null
  >(null);
  const formOptions = useMemo(
    () => ({
      values: {
        networkId:
          network?.id && network.id !== getNetworkIdsMap().onekeyall
            ? network?.id
            : getNetworkIdsMap().btc,
        deriveType: undefined,
        addressValue: { raw: '', resolved: undefined },
      },
      mode: 'onChange' as IFormMode,
      reValidateMode: 'onBlur' as IReValidateMode,
      onSubmit: async (formContext: UseFormReturn<IFormValues>) => {
        await onSubmitRef.current?.(formContext);
      },
    }),
    [network?.id],
  );
  const form = useForm<IFormValues>(formOptions);

  const { setValue, control } = form;
  //   const [validateResult, setValidateResult] = useState<
  //     IGeneralInputValidation | undefined
  //   >();
  //   const isValidating = useRef<boolean>(false);
  const networkIdText = useFormWatch({ control, name: 'networkId' });
  const addressValue = useFormWatch({ control, name: 'addressValue' });

  //   const validateFn = useCallback(async () => {
  //     if (inputTextDebounced && networkIdText) {
  //       const input =
  //         await backgroundApiProxy.servicePassword.encodeSensitiveText({
  //           text: inputTextDebounced,
  //         });
  //       try {
  //         if (!networksResp.publicKeyExportEnabled.has(networkIdText)) {
  //           throw new Error(`Network not supported: ${networkIdText}`);
  //         }
  //         const result =
  //           await backgroundApiProxy.serviceAccount.validateGeneralInputOfImporting(
  //             {
  //               input,
  //               networkId: networkIdText,
  //               validateXpub: true,
  //             },
  //           );
  //         setValidateResult(result);
  //         console.log('validateGeneralInputOfImporting result', result);
  //       } catch (error) {
  //         setValidateResult({
  //           isValid: false,
  //         });
  //       }
  //     } else {
  //       setValidateResult(undefined);
  //     }
  //   }, [networkIdText, networksResp.publicKeyExportEnabled]);

  //   useEffect(() => {
  //     void (async () => {
  //       try {
  //         isValidating.current = true;
  //         await validateFn();
  //       } finally {
  //         isValidating.current = false;
  //       }
  //     })();
  //   }, [validateFn]);

  const isEnable = useMemo(() => {
    // filter out error parameters from different segments.
    const errors = Object.values(form.formState.errors);
    if (errors.length) {
      return false;
    }
    return !addressValue.pending && form.formState.isValid;
  }, [addressValue.pending, form.formState]);

  onSubmitRef.current = useCallback(
    async (formContext: UseFormReturn<IFormValues>) => {
      const values = formContext.getValues();
      const data: {
        name?: string;
        input: string;
        networkId: string;
        deriveType?: IAccountDeriveTypes;
      } = {
        input: values.addressValue.resolved ?? '',
        networkId: values.networkId ?? '',
      };
      const r = await backgroundApiProxy.serviceAccount.addWatchingAccount(
        data,
      );

      const accountId = r?.accounts?.[0]?.id;
      if (accountId) {
        Toast.success({
          title: intl.formatMessage({ id: ETranslations.global_success }),
        });
      }

      void actions.current.updateSelectedAccountForSingletonAccount({
        num: 0,
        networkId: values.networkId,
        walletId: WALLET_TYPE_WATCHING,
        othersWalletAccountId: accountId,
      });
      navigation.popStack();

      defaultLogger.account.wallet.importWallet({
        importMethod: 'address',
      });
    },
    [actions, intl, navigation],
  );

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.address_book_edit_address_title,
        })}
      />
      <Page.Body px="$5">
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
            name="addressValue"
            rules={{
              validate: createValidateAddressRule({
                defaultErrorMessage: intl.formatMessage({
                  id: ETranslations.form_address_error_invalid,
                }),
              }),
            }}
          >
            <AddressInput
              enableAddressBook
              placeholder={intl.formatMessage({
                id: ETranslations.form_address_placeholder,
              })}
              networkId={networkIdText ?? ''}
              testID="import-address-input"
            />
          </Form.Field>
        </Form>
        <YStack gap="$5" mt="$1.5">
          <SizableText color="$textSubdued" size="$bodyMd">
            On the 1st of each month, a snapshot will be taken of eligible
            rewards and the current address.
          </SizableText>
          <SizableText color="$textSubdued" size="$bodyMd">
            Rewards will be sent to the address by the 10th of the same month.
          </SizableText>
        </YStack>
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
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[0]}
    >
      <BasicEditAddress />
    </AccountSelectorProviderMirror>
  );
}

export default EditAddress;
