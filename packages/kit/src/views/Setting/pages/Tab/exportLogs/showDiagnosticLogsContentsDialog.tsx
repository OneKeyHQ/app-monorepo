import {
  Dialog,
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IntlShape } from 'react-intl';

const INCLUDED_LOG_ITEM_IDS = [
  ETranslations.settings_diagnostic_logs_app_device_info__msg,
  ETranslations.settings_diagnostic_logs_errors__msg,
  ETranslations.settings_diagnostic_logs_public_addresses__msg,
] as const;

const EXCLUDED_LOG_ITEM_IDS = [
  ETranslations.settings_diagnostic_logs_recovery_phrases__msg,
  ETranslations.settings_diagnostic_logs_private_keys__msg,
] as const;

function DiagnosticLogCopySection({
  intl,
  titleId,
  itemIds,
  included = false,
}: {
  intl: IntlShape;
  titleId: ETranslations;
  itemIds: readonly ETranslations[];
  included?: boolean;
}) {
  return (
    <YStack gap="$2">
      <SizableText size="$headingSm">
        {intl.formatMessage({ id: titleId })}
      </SizableText>
      {itemIds.map((itemId) => (
        <XStack key={itemId} gap="$2" alignItems="flex-start">
          <Icon
            name={included ? 'CheckRadioOutline' : 'XCircleOutline'}
            size="$5"
            flexShrink={0}
            color="$iconSubdued"
          />
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
      id: ETranslations.settings_diagnostic_logs_contents__title,
    }),
    showCancelButton: false,
    onConfirmText: intl.formatMessage({
      id: ETranslations.global_i_got_it,
    }),
    renderContent: (
      <YStack gap="$4">
        <DiagnosticLogCopySection
          intl={intl}
          titleId={ETranslations.settings_diagnostic_logs_included__title}
          itemIds={INCLUDED_LOG_ITEM_IDS}
          included
        />
        <DiagnosticLogCopySection
          intl={intl}
          titleId={ETranslations.settings_diagnostic_logs_excluded__title}
          itemIds={EXCLUDED_LOG_ITEM_IDS}
        />
      </YStack>
    ),
  });
}
