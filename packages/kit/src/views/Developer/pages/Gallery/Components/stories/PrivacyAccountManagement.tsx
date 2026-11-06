import { useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { PrivacyAccountRow } from '@onekeyhq/kit/src/views/Setting/pages/PrivacyNetwork/PrivacyAccountRow';
import { ETranslations } from '@onekeyhq/shared/src/locale';

type IPreviewAccount = {
  id: string;
  name: string;
  state: 'enabled' | 'disabled' | 'paused';
};

const INITIAL_ACCOUNTS: IPreviewAccount[] = [
  { id: 'preview-enabled', name: 'Account #1', state: 'enabled' },
  { id: 'preview-disabled', name: 'Account #2', state: 'disabled' },
  { id: 'preview-paused', name: 'Account #3', state: 'paused' },
];

const SCENARIOS = [
  { value: 'default', label: 'Default' },
  { value: 'long-name', label: 'Long names' },
  { value: 'unavailable', label: 'Unavailable' },
] as const;

export function PrivacyAccountManagementPreview() {
  const intl = useIntl();
  const [accounts, setAccounts] = useState(INITIAL_ACCOUNTS);
  const [scenario, setScenario] =
    useState<(typeof SCENARIOS)[number]['value']>('default');
  const [previewWidth, setPreviewWidth] = useState<320 | 600>(600);
  const unavailable = scenario === 'unavailable';

  return (
    <YStack gap="$5" testID="privacy-account-management-preview">
      <YStack bg="$bgCautionSubdued" p="$3" borderRadius="$3" gap="$1">
        <SizableText size="$bodyMdMedium" color="$textCaution">
          Sample data · UI preview
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          Actions only change these examples. No account data is changed.
        </SizableText>
      </YStack>
      <XStack gap="$2" flexWrap="wrap">
        {SCENARIOS.map(({ value, label }) => (
          <Button
            key={value}
            testID={`privacy-management-preview-${value}`}
            size="small"
            variant={scenario === value ? 'primary' : 'secondary'}
            onPress={() => setScenario(value)}
          >
            {label}
          </Button>
        ))}
        <Button
          testID="privacy-management-preview-reset"
          size="small"
          onPress={() => {
            setAccounts(INITIAL_ACCOUNTS);
            setScenario('default');
          }}
        >
          {intl.formatMessage({ id: ETranslations.global_reset })}
        </Button>
        {([320, 600] as const).map((width) => (
          <Button
            key={width}
            testID={`privacy-management-preview-width-${width}`}
            size="small"
            variant={previewWidth === width ? 'primary' : 'secondary'}
            onPress={() => setPreviewWidth(width)}
          >
            {width} px
          </Button>
        ))}
      </XStack>
      <YStack mx="$-5" width={previewWidth} maxWidth="100%">
        {accounts.map((account) => {
          let statusId = ETranslations.global_enabled;
          if (unavailable) statusId = ETranslations.global_not_available;
          else if (account.state === 'disabled')
            statusId = ETranslations.global_disabled;
          else if (account.state === 'paused')
            statusId = ETranslations.syncing_paused__title;
          let actionId = ETranslations.global_pause;
          if (account.state === 'disabled')
            actionId = ETranslations.global_enable;
          else if (account.state === 'paused')
            actionId = ETranslations.global_resume;

          return (
            <PrivacyAccountRow
              key={account.id}
              accountId={account.id}
              accountName={
                scenario === 'long-name'
                  ? `${account.name} · Personal savings and long-term private funds`
                  : account.name
              }
              subtitle={`Preview wallet · ${intl.formatMessage({ id: statusId })}`}
              action={
                <Button
                  testID={`privacy-management-preview-action-${account.id}`}
                  size="small"
                  variant={
                    account.state === 'disabled' ? 'primary' : 'secondary'
                  }
                  disabled={unavailable}
                  onPress={() =>
                    setAccounts((current) =>
                      current.map((entry) =>
                        entry.id === account.id
                          ? {
                              ...entry,
                              state:
                                entry.state === 'enabled'
                                  ? 'paused'
                                  : 'enabled',
                            }
                          : entry,
                      ),
                    )
                  }
                >
                  {intl.formatMessage({ id: actionId })}
                </Button>
              }
              showBirthday={account.state !== 'disabled'}
              birthday={intl.formatDate(new Date(2026, 6, 28), {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
              })}
              birthdayDisabled={account.state === 'paused'}
              onEditBirthday={() =>
                Toast.success({
                  title: ETranslations.privacy_sync_start__title,
                })
              }
              onDelete={() => {
                Dialog.confirm({
                  title: intl.formatMessage({
                    id: ETranslations.privacy_delete_data__title,
                  }),
                  description: intl.formatMessage({
                    id: ETranslations.privacy_delete_data__desc,
                  }),
                  tone: 'destructive',
                  onConfirmText: intl.formatMessage({
                    id: ETranslations.global_delete,
                  }),
                  onConfirm: () =>
                    setAccounts((current) =>
                      current.filter((entry) => entry.id !== account.id),
                    ),
                });
              }}
            />
          );
        })}
      </YStack>
    </YStack>
  );
}
