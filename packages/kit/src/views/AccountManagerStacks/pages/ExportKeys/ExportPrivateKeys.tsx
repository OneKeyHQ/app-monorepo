import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import type {
  IKeyOfIcons,
  IPageScreenProps,
  IPropsWithTestId,
} from '@onekeyhq/components';
import {
  Form,
  Input,
  Page,
  SizableText,
  useClipboard,
  useForm,
  useMedia,
} from '@onekeyhq/components';
import { ECoreApiExportedSecretKeyType } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  AccountSelectorProviderMirror,
  ControlledNetworkSelectorTrigger,
} from '@onekeyhq/kit/src/components/AccountSelector';
import { DeriveTypeSelectorTriggerStaticInput } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type {
  IDBAccount,
  IDBIndexedAccount,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';
import type {
  EAccountManagerStacksRoutes,
  IAccountManagerStacksParamList,
} from '@onekeyhq/shared/src/routes';
import { noopObject } from '@onekeyhq/shared/src/utils/miscUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

type IFormValues = {
  networkId?: string;
  deriveType?: IAccountDeriveTypes | '';
  rawKeyContent: string;
};

function ExportPrivateKeysPage({
  indexedAccount,
  account,
  accountName,
}: {
  indexedAccount?: IDBIndexedAccount;
  account?: IDBAccount;
  accountName?: string;
}) {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const navigation = useAppNavigation();

  const intl = useIntl();
  const media = useMedia();

  const [secureEntry, setSecureEntry] = useState(true);
  const clipboard = useClipboard();

  const form = useForm<IFormValues>({
    values: {
      networkId: activeAccount?.network?.id ?? getNetworkIdsMap().btc,
      deriveType: activeAccount?.deriveType ?? undefined,
      rawKeyContent: '',
    },
    mode: 'onChange',
    reValidateMode: 'onBlur',
  });

  const networkIdValue = form.watch('networkId');
  const deriveTypeValue = form.watch('deriveType');
  const rawKeyValue = form.watch('rawKeyContent');

  const generateKey = useDebouncedCallback(
    async ({
      indexedAccountId,
      networkId,
      deriveType,
    }: {
      indexedAccountId: string;
      networkId: string;
      deriveType: IAccountDeriveTypes | undefined | '';
    }) => {
      if (!indexedAccountId || !networkId || !deriveType) {
        return;
      }
      try {
        const dbAccountId =
          await backgroundApiProxy.serviceAccount.getDbAccountIdFromIndexedAccountId(
            {
              indexedAccountId,
              networkId,
              deriveType,
            },
          );
        const dbAccount =
          await backgroundApiProxy.serviceAccount.getDBAccountSafe({
            accountId: dbAccountId,
          });
        if (!dbAccount) {
          throw new Error(
            `${accountName || ''}: ${intl.formatMessage({
              id: ETranslationsMock.export_account_keys_address_not_created,
            })}`,
          );
        }
        const key =
          await backgroundApiProxy.serviceAccount.exportAccountSecretKey({
            accountId: dbAccountId,
            networkId,
            keyType: ECoreApiExportedSecretKeyType.privateKey,
          });
        if (key) {
          form.setValue('rawKeyContent', key);
        }
      } catch (error) {
        form.setError(
          'rawKeyContent',
          // form.setError use {...error} which will lose error.message
          // so we should use errorUtils.toPlainErrorObject to convert error to plain object
          errorUtils.toPlainErrorObject(error as any) ?? { message: 'error' },
        );
        throw error;
      }
    },
    600,
  );

  const reset = useCallback(() => {
    form.setValue('rawKeyContent', '');
    form.clearErrors('rawKeyContent');
    setSecureEntry(true);
  }, [form]);

  const refreshKey = useCallback(async () => {
    reset();
    await generateKey({
      indexedAccountId: indexedAccount?.id || '',
      networkId: networkIdValue || '',
      deriveType: deriveTypeValue,
    });
  }, [deriveTypeValue, generateKey, indexedAccount?.id, networkIdValue, reset]);

  const actions: IPropsWithTestId<{
    iconName?: IKeyOfIcons;
    onPress?: () => void;
    loading?: boolean;
  }>[] = useMemo(
    () =>
      rawKeyValue
        ? [
            {
              iconName: secureEntry ? 'EyeOutline' : 'EyeOffOutline',
              onPress: () => {
                setSecureEntry(!secureEntry);
              },
            },

            {
              iconName: 'Copy3Outline',
              onPress: () => {
                clipboard.copyText(form.getValues('rawKeyContent'));
              },
            },
          ]
        : [
            {
              iconName: 'RefreshCcwOutline',
              onPress: () => {
                void refreshKey();
              },
            },
          ],
    [clipboard, form, rawKeyValue, refreshKey, secureEntry],
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

  return (
    <Page scrollEnabled safeAreaEnabled={false}>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.global_private_key,
        })}
      />
      <Page.Body p="$4">
        <Form form={form}>
          <Form.Field
            label={intl.formatMessage({ id: ETranslations.global_network })}
            name="networkId"
          >
            <ControlledNetworkSelectorTrigger />
          </Form.Field>

          <Form.Field
            label={intl.formatMessage({
              id: ETranslations.derivation_path,
            })}
            name="deriveType"
          >
            <DeriveTypeSelectorTriggerStaticInput
              networkId={networkIdValue || ''}
              defaultTriggerInputProps={{
                size: media.gtMd ? 'medium' : 'large',
              }}
            />
          </Form.Field>

          <Form.Field
            label={intl.formatMessage({
              id: ETranslationsMock.export_account_keys_private_key,
            })}
            name="rawKeyContent"
          >
            <Input
              size={media.gtMd ? 'medium' : 'large'}
              editable={false}
              placeholder={intl.formatMessage({
                id: ETranslationsMock.export_account_keys_private_key,
              })}
              secureTextEntry={secureEntry}
              addOns={actions}
            />
          </Form.Field>
        </Form>

        <SizableText>networkId: {networkIdValue}</SizableText>
        <SizableText>deriveType: {deriveTypeValue}</SizableText>
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
  const { account, indexedAccount, accountName } = route.params || {};
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
    >
      <ExportPrivateKeysPage
        account={account}
        indexedAccount={indexedAccount}
        accountName={accountName}
      />
    </AccountSelectorProviderMirror>
  );
}
