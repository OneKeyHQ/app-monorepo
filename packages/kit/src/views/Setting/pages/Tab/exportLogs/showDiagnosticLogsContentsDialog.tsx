import { Dialog, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IntlShape } from 'react-intl';

const INCLUDED_LOG_ITEM_IDS = [
  ETranslations.settings_export_diagnostic_logs__item_local_data,
  ETranslations.settings_export_diagnostic_logs__item_crash_reports,
  ETranslations.settings_export_diagnostic_logs__item_public_addresses,
] as const;

const EXCLUDED_LOG_ITEM_IDS = [
  ETranslations.settings_export_diagnostic_logs__item_recovery_phrases,
  ETranslations.settings_export_diagnostic_logs__item_private_keys,
] as const;

function DiagnosticLogCopySection({
  intl,
  titleId,
  itemIds,
}: {
  intl: IntlShape;
  titleId: ETranslations;
  itemIds: readonly ETranslations[];
}) {
  return (
    <YStack gap="$2">
      <SizableText size="$headingSm">
        {intl.formatMessage({ id: titleId })}
      </SizableText>
      {itemIds.map((itemId) => (
        <XStack key={itemId} gap="$2" alignItems="flex-start">
          <SizableText size="$bodyMd" color="$textSubdued">
            •
          </SizableText>
          <SizableText size="$bodyMd" flex={1}>
            {intl.formatMessage({ id: itemId })}
          </SizableText>
        </XStack>
      ))}
    </YStack>
  );
}

export function showDiagnosticLogsContentsDialog({
  intl,
}: {
  intl: IntlShape;
}) {
  return Dialog.show({
    icon: 'InfoCircleOutline',
    title: intl.formatMessage({
      id: ETranslations.settings_export_diagnostic_logs__learn_more,
    }),
    showCancelButton: false,
    onConfirmText: intl.formatMessage({
      id: ETranslations.global_i_got_it,
    }),
    renderContent: (
      <YStack gap="$4">
        <DiagnosticLogCopySection
          intl={intl}
          titleId={ETranslations.settings_export_diagnostic_logs__included}
          itemIds={INCLUDED_LOG_ITEM_IDS}
        />
        <DiagnosticLogCopySection
          intl={intl}
          titleId={ETranslations.settings_export_diagnostic_logs__not_included}
          itemIds={EXCLUDED_LOG_ITEM_IDS}
        />
      </YStack>
    ),
  });
}
