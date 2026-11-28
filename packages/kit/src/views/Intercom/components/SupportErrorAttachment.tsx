import { useIntl } from 'react-intl';

import {
  Dialog,
  Icon,
  IconButton,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatTime } from '@onekeyhq/shared/src/utils/dateUtils';

import type { ISupportErrorContext } from '../supportLog/supportRequest';

// Error details attached to the next typed message; removable before sending.
export function SupportErrorAttachment({
  errorContext,
  onRemove,
}: {
  errorContext: ISupportErrorContext;
  onRemove: () => void;
}) {
  const intl = useIntl();
  const label = intl.formatMessage({
    id: ETranslations.support_error_info__title,
  });
  const time = formatTime(new Date(errorContext.occurredAt), {
    hideSeconds: true,
  });
  return (
    <XStack
      testID="support-error-attachment"
      alignItems="center"
      gap="$2.5"
      pl="$3"
      borderWidth={1}
      borderColor="$borderSubdued"
      borderRadius="$3"
      bg="$bgSubdued"
    >
      <Icon name="ErrorOutline" size="$5" color="$iconCritical" />
      <Stack
        flex={1}
        py="$2"
        role="button"
        cursor="pointer"
        onPress={() => {
          Dialog.show({
            title: label,
            showFooter: false,
            renderContent: (
              <SizableText size="$bodyMd" selectable>
                {errorContext.diagnosticText}
              </SizableText>
            ),
          });
        }}
      >
        <SizableText size="$bodyMdMedium" numberOfLines={1}>
          {errorContext.title || label}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          {`${label} · ${time}`}
        </SizableText>
      </Stack>
      <IconButton
        testID="support-error-attachment-remove"
        variant="tertiary"
        size="small"
        icon="CrossedSmallOutline"
        accessibilityLabel={intl.formatMessage({
          id: ETranslations.global_remove,
        })}
        onPress={onRemove}
      />
    </XStack>
  );
}
