import { useState } from 'react';

import natsort from 'natsort';
import { useIntl } from 'react-intl';

import type { ISelectItem } from '@onekeyhq/components';
import {
  Button,
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
    return accounts
      .map((account) => {
        const networkId = v4CoinTypeToNetworkId[account.coinType];
        const item: ISelectItem & {
          networkId?: string;
        } = {
          label: account.name,
          value: account.name,
          leading: <NetworkAvatar networkId={networkId} />,
          networkId,
        };
        return item;
      })
      .sort((a, b) =>
        natsort({ insensitive: true })(a.networkId || '', b.networkId || ''),
      );
  }, [indexedAccount.id]);

  return (
    <Stack pt="$2">
      <Select
        sheetProps={{ snapPoints: [80], snapPointsMode: 'percent' }}
        floatingPanelProps={{
          maxHeight: 272,
        }}
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        renderTrigger={({ value, label, placeholder }) => (
          <Button
            size="small"
            alignSelf="flex-start"
            variant="tertiary"
            iconAfter="ChevronDownSmallOutline"
          >
            {intl.formatMessage({
              id: ETranslations.v4_select_account_name_label,
            })}
          </Button>
        )}
        items={items}
        value={val}
        onChange={onChange}
        title={intl.formatMessage({
          id: ETranslations.v4_select_account_name_label,
        })}
      />
    </Stack>
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
        return backgroundApiProxy.serviceV4Migration.canRenameFromV4AccountName(
          {
            indexedAccount,
          },
        );
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
