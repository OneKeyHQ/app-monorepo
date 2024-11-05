import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import type {
  IKeyOfIcons,
  IPageScreenProps,
  IPropsWithTestId,
  ITextAreaInputProps,
} from '@onekeyhq/components';
import {
  Form,
  Page,
  SizableText,
  Stack,
  TextAreaInput,
  useClipboard,
  useForm,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  AccountSelectorProviderMirror,
  ControlledNetworkSelectorTrigger,
} from '@onekeyhq/kit/src/components/AccountSelector';
import { DeriveTypeSelectorFormField } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EOneKeyErrorClassNames,
  type IOneKeyError,
} from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EAccountManagerStacksRoutes,
  IAccountManagerStacksParamList,
  IExportAccountSecretKeysRouteParams,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { noopObject } from '@onekeyhq/shared/src/utils/miscUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { showCopyPrivateKeysDialog } from './showCopyPrivateKeysDialog';

type IFormValues = {
  networkId?: string;
  deriveType?: IAccountDeriveTypes | '';
  rawKeyContent: string;
};

function SecureEntryTextArea({
  secureEntry,
  value,
  onChange,
  ...props
}: Omit<ITextAreaInputProps, 'onChange'> & {
  onChange?: ITextAreaInputProps['onChangeText'];
  secureEntry: boolean;
}) {
  return (
    <TextAreaInput
      testID="account-key-input"
      value={secureEntry ? undefined : value}
      onChangeText={onChange}
      {...props}
    />
  );
}

function ExportPrivateKeysPage({
  indexedAccount,
  account,
  accountName,
  title,
  exportType,
}: IExportAccountSecretKeysRouteParams) {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const navigation = useAppNavigation();

  const intl = useIntl();
  const media = useMedia();

  const [secureEntry, setSecureEntry] = useState(true);
  const clipboard = useClipboard();

  const isImportedAccount = useMemo(
    () =>
      Boolean(
        account &&
          !indexedAccount &&
          accountUtils.isImportedAccount({ accountId: account?.id }),
      ),
    [account, indexedAccount],
  );

  const isWatchingAccount = useMemo(
    () =>
      Boolean(
        account &&
          !indexedAccount &&
          accountUtils.isWatchingAccount({ accountId: account?.id }),
      ),
    [account, indexedAccount],
  );

  const isHdAccount = !!indexedAccount;

  const { result: networkIds = [] } = usePromiseResult(async () => {
    if (
      (isImportedAccount && account?.createAtNetwork) ||
      (isWatchingAccount && account?.createAtNetwork)
    ) {
      return [account?.createAtNetwork];
    }
    const networksInfo =
      await backgroundApiProxy.serviceNetwork.getSupportExportAccountKeyNetworks(
        {
          exportType,
        },
      );
    return networksInfo.map((n) => n.network.id);
  }, [
    account?.createAtNetwork,
    exportType,
    isImportedAccount,
    isWatchingAccount,
  ]);

  const initialNetworkId = useMemo(() => {
    if (isImportedAccount || isWatchingAccount) {
      return account?.createAtNetwork || getNetworkIdsMap().btc;
    }
    return activeAccount?.network?.id || getNetworkIdsMap().btc;
  }, [
    account?.createAtNetwork,
    activeAccount?.network?.id,
    isImportedAccount,
    isWatchingAccount,
  ]);
  const form = useForm<IFormValues>({
    values: {
      networkId: initialNetworkId,
      deriveType: activeAccount?.deriveType ?? undefined,
      rawKeyContent: '',
    },
    mode: 'onChange',
    reValidateMode: 'onBlur',
  });

  const networkIdValue = form.watch('networkId');
  const deriveTypeValue = form.watch('deriveType');

  const reset = useCallback(() => {
    form.setValue('rawKeyContent', '');
    form.clearErrors('rawKeyContent');
    setSecureEntry(true);
  }, [form]);

  const generateKey = useCallback(
    async ({
      accountId,
      indexedAccountId,
      networkId,
      deriveType,
    }: {
      accountId: string | undefined;
      indexedAccountId: string | undefined;
      networkId: string;
      deriveType: IAccountDeriveTypes | undefined | '';
    }) => {
      reset();
      if ((!indexedAccountId && !accountId) || !networkId) {
        return;
      }
      if (isHdAccount && !deriveType) {
        return;
      }
      try {
        const key =
          await backgroundApiProxy.serviceAccount.exportAccountKeysByType({
            indexedAccountId,
            accountId,
            networkId,
            deriveType: deriveType || undefined,
            exportType,
            accountName,
          });
        if (key) {
          form.setValue('rawKeyContent', key);
        }
      } catch (error) {
        const ignoreErrorClasses: Array<EOneKeyErrorClassNames | undefined> = [
          EOneKeyErrorClassNames.PasswordPromptDialogCancel,
        ];
        if (!ignoreErrorClasses.includes((error as IOneKeyError)?.className)) {
          form.setError(
            'rawKeyContent',
            // form.setError use {...error} which will lose error.message
            // so we should use errorUtils.toPlainErrorObject to convert error to plain object
            errorUtils.toPlainErrorObject(error as any) ?? { message: 'error' },
          );
        }
        throw error;
      }
    },
    [accountName, exportType, form, isHdAccount, reset],
  );
  const generateKeyDebounced = useDebouncedCallback(generateKey, 600);

  const refreshKey = useCallback(
    async ({ noDebouncedCall }: { noDebouncedCall?: boolean } = {}) => {
      const fn = noDebouncedCall ? generateKey : generateKeyDebounced;
      await fn({
        accountId: account?.id,
        indexedAccountId: indexedAccount?.id,
        networkId: networkIdValue || '',
        deriveType: deriveTypeValue,
      });
    },
    [
      account?.id,
      deriveTypeValue,
      generateKey,
      generateKeyDebounced,
      indexedAccount?.id,
      networkIdValue,
    ],
  );

  const actions: IPropsWithTestId<{
    iconName?: IKeyOfIcons;
    onPress?: () => void;
    loading?: boolean;
  }>[] = useMemo(
    () => [
      {
        testID: 'account-key-show-btn',
        iconName: secureEntry ? 'EyeOutline' : 'EyeOffOutline',
        onPress: async () => {
          const rawKeyValue = form.getValues('rawKeyContent') || '';
          if (!rawKeyValue) {
            await refreshKey({ noDebouncedCall: true });
          }
          const nextSecureEntry = !secureEntry;
          if (nextSecureEntry) {
            reset();
          }
          setSecureEntry(nextSecureEntry);
        },
      },
      {
        iconName: 'Copy3Outline',
        testID: 'account-key-copy-btn',
        onPress: async () => {
          let keyContent = form.getValues('rawKeyContent') || '';
          if (!keyContent) {
            await refreshKey({ noDebouncedCall: true });
          }
          keyContent = form.getValues('rawKeyContent') || '';
          if (exportType === 'privateKey') {
            showCopyPrivateKeysDialog({
              title: intl.formatMessage({
                id: ETranslations.global_private_key_copy,
              }),
              description: intl.formatMessage({
                id: ETranslations.global_private_key_copy_information,
              }),
              showCheckBox: true,
              defaultChecked: false,
              rawKeyContent: keyContent,
            });
          } else {
            clipboard.copyText(keyContent);
          }
        },
      },
    ],
    [clipboard, exportType, form, intl, refreshKey, reset, secureEntry],
  );

  useEffect(() => {
    if (networkIdValue) {
      // reset deriveType when networkId changed, DeriveTypeSelectorTriggerStaticInput will re-fetch deriveTypes from global settings
      form.setValue('deriveType', '');
    }
  }, [form, networkIdValue]);

  useEffect(() => {
    noopObject(networkIdValue, deriveTypeValue);
    reset();
  }, [deriveTypeValue, networkIdValue, reset]);

  // use manual refreshKey instead of auto refreshKey
  // useEffect(() => {
  //   void refreshKey();
  // }, [refreshKey]);

  const keyLabel = useMemo(() => {
    let label = 'key';
    if (exportType === 'publicKey') {
      label = intl.formatMessage({ id: ETranslations.global_public_key });
    }
    if (exportType === 'privateKey') {
      label = intl.formatMessage({ id: ETranslations.global_private_key });
    }
    return label;
  }, [exportType, intl]);

  return (
    <Page scrollEnabled safeAreaEnabled>
      <Page.Header title={title} />
      <Page.Body p="$4">
        <Form form={form}>
          <Form.Field
            label={intl.formatMessage({ id: ETranslations.global_network })}
            name="networkId"
            disabled={isImportedAccount}
            // editable={!isImportedAccount}
          >
            <ControlledNetworkSelectorTrigger
              disabled={isImportedAccount}
              editable={!isImportedAccount}
              networkIds={networkIds}
            />
          </Form.Field>

          {!isImportedAccount && !isWatchingAccount ? (
            <DeriveTypeSelectorFormField
              fieldName="deriveType"
              networkId={networkIdValue}
            />
          ) : null}

          <Form.Field label={keyLabel} name="rawKeyContent">
            <SecureEntryTextArea
              secureEntry={secureEntry}
              testID="account-key-input"
              size={media.gtMd ? 'medium' : 'large'}
              editable={false}
              placeholder="••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••"
              addOns={actions}
              displayAsMaskWhenEmptyValue
            />
          </Form.Field>
        </Form>

        {exportType === 'privateKey' ? (
          <Stack py="$4">
            <Stack h="$4" />
            <SizableText color="$textSubdued" size="$headingSm">
              {intl.formatMessage({
                id: ETranslations.faq_private_key,
              })}
            </SizableText>
            <SizableText color="$textSubdued" size="$bodyMd">
              {intl.formatMessage({
                id: ETranslations.faq_private_key_desc,
              })}
            </SizableText>

            <Stack h="$4" />

            <SizableText color="$textSubdued" size="$headingSm">
              {intl.formatMessage({
                id: ETranslations.faq_private_key_keep,
              })}
            </SizableText>
            <SizableText color="$textSubdued" size="$bodyMd">
              {intl.formatMessage({
                id: ETranslations.faq_private_key_keep_desc,
              })}
            </SizableText>
          </Stack>
        ) : null}

        {process.env.NODE_ENV !== 'production' ? (
          <Stack mt="$8">
            <SizableText>networkId: {networkIdValue}</SizableText>
            <SizableText>deriveType: {deriveTypeValue}</SizableText>
          </Stack>
        ) : null}
      </Page.Body>
      <Page.Footer
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_done,
        })}
        confirmButtonProps={{
          disabled: false,
        }}
        onConfirm={async () => {
          void navigation.popStack();
        }}
      />
    </Page>
  );
}

export default function ExportPrivateKeys({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  route,
}: IPageScreenProps<
  IAccountManagerStacksParamList,
  EAccountManagerStacksRoutes.ExportPrivateKeysPage
>) {
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
    >
      <ExportPrivateKeysPage {...route.params} />
    </AccountSelectorProviderMirror>
  );
}
