import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type {
  IFormMode,
  IReValidateMode,
  UseFormReturn,
} from '@onekeyhq/components';
import { Toast, useForm, useFormWatch } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAccountSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorTrigger';
import type { IAddressInputValue } from '@onekeyhq/kit/src/components/AddressInput';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IGeneralInputValidation } from '@onekeyhq/shared/types/address';

export type IFormValues = {
  networkId?: string;
  deriveType?: IAccountDeriveTypes;
  publicKeyValue: string;
  addressValue: IAddressInputValue;
  accountName?: string;
};

export enum EImportMethod {
  Address = 'Address',
  PublicKey = 'PublicKey',
}

interface IUseImportAddressFormProps {
  onWalletAdded?: () => void;
}

export function useImportAddressForm({
  onWalletAdded,
}: IUseImportAddressFormProps) {
  const intl = useIntl();

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
  const [method, setMethod] = useState<EImportMethod>(EImportMethod.Address);
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
        publicKeyValue: '',
        addressValue: { raw: '', resolved: undefined },
        accountName: '',
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
  const { control } = form;

  const [validateResult, setValidateResult] = useState<
    IGeneralInputValidation | undefined
  >();
  const isValidating = useRef<boolean>(false);
  const networkIdText = useFormWatch({ control, name: 'networkId' });
  const inputText = useFormWatch({ control, name: 'publicKeyValue' });
  const addressValue = useFormWatch({ control, name: 'addressValue' });
  const accountName = useFormWatch({ control, name: 'accountName' });

  const inputTextDebounced = useDebounce(inputText.trim(), 600);
  const accountNameDebounced = useDebounce(accountName?.trim() || '', 600);

  const validateFn = useCallback(async () => {
    if (accountNameDebounced) {
      try {
        await backgroundApiProxy.serviceAccount.ensureAccountNameNotDuplicate({
          name: accountNameDebounced,
          walletId: WALLET_TYPE_WATCHING,
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

    if (inputTextDebounced && networkIdText) {
      const input =
        await backgroundApiProxy.servicePassword.encodeSensitiveText({
          text: inputTextDebounced,
        });
      try {
        if (!networksResp.publicKeyExportEnabled.has(networkIdText)) {
          throw new OneKeyLocalError(`Network not supported: ${networkIdText}`);
        }
        const result =
          await backgroundApiProxy.serviceAccount.validateGeneralInputOfImporting(
            {
              input,
              networkId: networkIdText,
              validateXpub: true,
            },
          );
        setValidateResult(result);
      } catch (error) {
        setValidateResult({
          isValid: false,
        });
      }
    } else {
      setValidateResult(undefined);
    }
  }, [
    accountNameDebounced,
    inputTextDebounced,
    networkIdText,
    form,
    networksResp.publicKeyExportEnabled,
  ]);

  useEffect(() => {
    void (async () => {
      try {
        isValidating.current = true;
        await validateFn();
      } finally {
        isValidating.current = false;
      }
    })();
  }, [validateFn]);

  const isEnable = useMemo(() => {
    const errorsCount = Object.keys(form.formState.errors).reduce(
      (count, name) => {
        if (method === EImportMethod.PublicKey) {
          return name !== 'addressValue' ? count + 1 : count;
        }
        if (method === EImportMethod.Address) {
          return name !== 'publicKeyValue' ? count + 1 : count;
        }
        return count;
      },
      0,
    );
    if (errorsCount > 0) {
      return false;
    }
    if (method === EImportMethod.Address) {
      return !addressValue.pending && form.formState.isValid;
    }
    return validateResult?.isValid ?? false;
  }, [method, addressValue.pending, validateResult, form.formState]);

  const isKeyExportEnabled = useMemo(
    () =>
      Boolean(
        networkIdText && networksResp.publicKeyExportEnabled.has(networkIdText),
      ),
    [networkIdText, networksResp.publicKeyExportEnabled],
  );

  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();
  const isPublicKeyImport = useMemo(
    () => method === EImportMethod.PublicKey && isKeyExportEnabled,
    [method, isKeyExportEnabled],
  );

  onSubmitRef.current = useCallback(
    async (formContext: UseFormReturn<IFormValues>) => {
      const values = formContext.getValues();
      const data: {
        name?: string;
        input: string;
        networkId: string;
        deriveType?: IAccountDeriveTypes;
        shouldCheckDuplicateName?: boolean;
      } = isPublicKeyImport
        ? {
            name: values.accountName,
            input: values.publicKeyValue ?? '',
            networkId: values.networkId ?? '',
            deriveType: values.deriveType,
            shouldCheckDuplicateName: true,
          }
        : {
            name: values.accountName,
            input: values.addressValue.resolved ?? '',
            networkId: values.networkId ?? '',
            shouldCheckDuplicateName: true,
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

      defaultLogger.account.wallet.walletAdded({
        status: 'success',
        addMethod: 'ImportWallet',
        details: {
          importType: 'address',
        },
        isSoftwareWalletOnlyUser,
      });

      onWalletAdded?.();
    },
    [actions, intl, isPublicKeyImport, isSoftwareWalletOnlyUser, onWalletAdded],
  );

  return {
    form,
    isEnable,
    method,
    setMethod,
    networksResp,
    isKeyExportEnabled,
    isPublicKeyImport,
    validateResult,
    inputTextDebounced,
    networkIdText,
    deriveTypeValue: form.watch('deriveType'),
  };
}
