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
import { presetNetworksMap } from '@onekeyhq/shared/src/config/presetNetworks';
import { ETranslations } from '@onekeyhq/shared/src/locale';

type IPreviewAccount = {
  id: string;
  number: number;
  networkId: string;
  state: 'enabled' | 'disabled' | 'paused';
};

const INITIAL_ACCOUNTS: IPreviewAccount[] = [
  {
    id: 'preview-enabled',
    number: 1,
    networkId: presetNetworksMap.zec.id,
    state: 'enabled',
  },
  {
    id: 'preview-disabled',
    number: 1,
    networkId: presetNetworksMap.xmr.id,
    state: 'disabled',
  },
  {
    id: 'preview-paused',
    number: 2,
    networkId: presetNetworksMap.xmr.id,
    state: 'paused',
  },
];

const SCENARIOS = [
  { value: 'default', labelId: ETranslations.global_default },
  { value: 'long-name', labelId: ETranslations.dev_preview_long_names__title },
  { value: 'unavailable', labelId: ETranslations.global_not_available },
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
          {intl.formatMessage({ id: ETranslations.preview__action })}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.dev_preview_sample_data__desc,
          })}
        </SizableText>
      </YStack>
      <XStack gap="$2" flexWrap="wrap">
        {SCENARIOS.map(({ value, labelId }) => (
          <Button
            key={value}
            testID={`privacy-management-preview-${value}`}
            size="small"
            variant={scenario === value ? 'primary' : 'secondary'}
            onPress={() => setScenario(value)}
          >
            {intl.formatMessage({ id: labelId })}
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
              networkId={account.networkId}
              accountName={intl.formatMessage(
                {
                  id:
                    scenario === 'long-name'
                      ? ETranslations.dev_preview_long_account_name__title
                      : ETranslations.dev_preview_account_name__title,
                },
                { number: intl.formatNumber(account.number) },
              )}
              subtitle={`${intl.formatMessage({ id: ETranslations.global_wallet })} · ${intl.formatMessage({ id: statusId })}`}
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
