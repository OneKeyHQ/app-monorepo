import { useState } from 'react';

import { useIntl } from 'react-intl';

import type { ISelectItem } from '@onekeyhq/components';
import {
  Dialog,
  Input,
  Select,
  SizableText,
  Stack,
  Toast,
} from '@onekeyhq/components';
import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';
import type { IDBIndexedAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { v4CoinTypeToNetworkId } from '@onekeyhq/kit-bg/src/migrations/v4ToV5Migration/v4CoinTypeToNetworkId';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { NetworkAvatar } from '../NetworkAvatar';

function V4AccountNameSelector({
  onChange,
  indexedAccount,
}: {
  onChange?: (val: string) => void;
  indexedAccount: IDBIndexedAccount;
}) {
  const intl = useIntl();
  const [val] = useState('');
  const { result: items = [] } = usePromiseResult(async () => {
    const accounts =
      await backgroundApiProxy.serviceAccount.getAccountsInSameIndexedAccountId(
        {
          indexedAccountId: indexedAccount.id,
        },
      );
    console.log(accounts);
    return accounts.map((account) => {
      const item: ISelectItem = {
        label: account.name,
        value: account.name,
        leading: (
          <NetworkAvatar networkId={v4CoinTypeToNetworkId[account.coinType]} />
        ),
      };
      return item;
    });
  }, [indexedAccount.id]);

  return (
    <Select
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      renderTrigger={({ value, label, placeholder }) => (
        <SizableText>
          {intl.formatMessage({
            id: ETranslationsMock.v4_account_rename_button_text,
          })}
        </SizableText>
      )}
      items={items}
      value={val}
      onChange={onChange}
      title={intl.formatMessage({
        id: ETranslationsMock.v4_account_rename_selector_title,
      })}
      onOpenChange={console.log}
    />
  );
}

function RenameInputWithNameSelector({
  value,
  onChange,
  maxLength = 24,
  indexedAccount,
}: {
  maxLength?: number;
  value?: string;
  onChange?: (val: string) => void;
  indexedAccount?: IDBIndexedAccount;
}) {
  const { result: shouldShowV4AccountNameSelector } =
    usePromiseResult(async () => {
      if (indexedAccount) {
        return backgroundApiProxy.serviceV4Migration.checkIfV4DbExist();
      }
      return false;
    }, [indexedAccount]);
  return (
    <Stack>
      <Input
        size="large"
        $gtMd={{ size: 'medium' }}
        maxLength={maxLength}
        autoFocus
        value={value}
        onChangeText={onChange}
      />
      {shouldShowV4AccountNameSelector && indexedAccount ? (
        <V4AccountNameSelector
          indexedAccount={indexedAccount}
          onChange={onChange}
        />
      ) : null}
    </Stack>
  );
}

export const showRenameDialog = (
  name: string,
  {
    onSubmit,
    maxLength = 24,
    indexedAccount,
    ...dialogProps
  }: IDialogShowProps & {
    indexedAccount?: IDBIndexedAccount;
    maxLength?: number;
    onSubmit: (name: string) => Promise<void>;
  },
) =>
  Dialog.show({
    title: appLocale.intl.formatMessage({ id: ETranslations.global_rename }),
    renderContent: (
      <Dialog.Form formProps={{ values: { name } }}>
        <Dialog.FormField
          name="name"
          rules={{
            required: { value: true, message: 'Name is required.' },
          }}
        >
          <RenameInputWithNameSelector
            maxLength={maxLength}
            indexedAccount={indexedAccount}
          />
        </Dialog.FormField>
      </Dialog.Form>
    ),
    onConfirm: async ({ getForm, close }) => {
      const form = getForm();
      try {
        await onSubmit(form?.getValues().name);
        // fix toast dropped frames
        await close();
        Toast.success({
          title: appLocale.intl.formatMessage({
            id: ETranslations.feedback_change_saved,
          }),
        });
      } catch (error: unknown) {
        Toast.error({
          title: `Change Failed via ${(error as Error).message}`,
        });
        throw error;
      }
    },
    ...dialogProps,
  });
