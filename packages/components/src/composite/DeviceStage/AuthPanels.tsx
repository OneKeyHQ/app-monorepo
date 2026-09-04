import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  Anchor,
  Button,
  Icon,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '../../primitives';

import { AUTH_FAILURE_TEXT } from './stepCopy';
import { StepText } from './StepText';

import type { IAuthChecklistItem, IAuthFailureReason } from './type';

/**
 * The authenticity flow's own furniture, shared by both engines. The
 * checklist is the new-firmware verification played out line by line —
 * the driver owns the rows and their progress, the stage only renders
 * them: a row is pending (dim ring), in progress (spinner + label),
 * verified (green check, the result value — linked to its release page
 * when one exists), or failed (red cross + Failed). The failure card
 * fronts a critical icon where the staged steps front the replica. A
 * failed authenticity check never permits bypassing verification.
 */

function ChecklistRow({ item }: { item: IAuthChecklistItem }) {
  const intl = useIntl();
  return (
    <XStack gap="$2" alignItems="center" minHeight="$6">
      <Stack w="$6" h="$6" alignItems="center" justifyContent="center">
        {item.status === 'ok' ? (
          <Icon name="CheckRadioSolid" size="$6" color="$iconSuccess" />
        ) : null}
        {item.status === 'failed' ? (
          <Icon name="XCircleSolid" size="$6" color="$iconCritical" />
        ) : null}
        {item.status === 'loading' ? <Spinner size="small" /> : null}
        {item.status === 'pending' ? (
          // The waiting ring, the live dialog's own recipe: a dim empty
          // circle holding the row's place in the sequence.
          <Stack
            w="$5"
            h="$5"
            borderWidth={2}
            borderColor="$icon"
            opacity={0.2}
            borderRadius="$full"
          />
        ) : null}
      </Stack>
      <SizableText flex={1} size="$bodyMd">
        {item.label}
      </SizableText>
      {item.status === 'loading' ? (
        // The verifying label the live checklist shows on the active row.
        <SizableText size="$bodyMd">
          {intl.formatMessage({
            id: ETranslations.device_auth_verifying_component_label,
          })}
        </SizableText>
      ) : null}
      {item.status === 'failed' ? (
        <SizableText size="$bodyMd" color="$textCritical">
          {intl.formatMessage({ id: ETranslations.global_failed })}
        </SizableText>
      ) : null}
      {item.status === 'ok' && item.value && item.url ? (
        // Underline only — the design carries no external-link arrow.
        <Anchor
          href={item.url}
          size="$bodyMd"
          color="$textSuccess"
          showExternalIndicator={false}
          textDecorationLine="underline"
        >
          {item.value}
        </Anchor>
      ) : null}
      {item.status === 'ok' && item.value && !item.url ? (
        <SizableText size="$bodyMd" color="$textSuccess">
          {item.value}
        </SizableText>
      ) : null}
    </XStack>
  );
}

export function AuthChecklist({ items }: { items: IAuthChecklistItem[] }) {
  return (
    <YStack gap="$2">
      {items.map((item) => (
        <ChecklistRow key={item.label} item={item} />
      ))}
    </YStack>
  );
}

export function AuthFailureCard({
  reason = 'unknown',
  checklist,
  onSupport,
  onRetry,
}: {
  reason?: IAuthFailureReason;
  /** The rows that ended in failure — the unofficial-firmware shape. */
  checklist?: IAuthChecklistItem[];
  onSupport?: () => void;
  onRetry?: () => void;
}) {
  const intl = useIntl();
  const copy = AUTH_FAILURE_TEXT[reason];
  const failureTitle = intl.formatMessage({ id: copy.title });

  return (
    <YStack gap="$6">
      <Stack alignSelf="center" p="$4" borderRadius="$full" bg="$bgCritical">
        <Icon name={copy.icon} size="$10" color="$iconCritical" />
      </Stack>
      {/* The words block's own bottom padding is its gap to what
          follows; the blocks after it keep the card's 24. */}
      <YStack>
        <StepText
          title={failureTitle}
          sub={intl.formatMessage({ id: copy.sub })}
          animated={false}
        />
        <YStack gap="$6">
          {checklist?.length ? <AuthChecklist items={checklist} /> : null}
          {copy.action === 'support' && onSupport ? (
            <Button
              testID="device-stage-auth-support"
              variant="primary"
              size="large"
              onPress={onSupport}
            >
              {intl.formatMessage({ id: ETranslations.global_support })}
            </Button>
          ) : null}
          {copy.action === 'retry' ? (
            <YStack gap="$2">
              <Button
                testID="device-stage-auth-retry"
                variant="primary"
                size="large"
                onPress={onRetry}
              >
                {intl.formatMessage({ id: ETranslations.global_retry })}
              </Button>
              {onSupport ? (
                <Button
                  testID="device-stage-auth-support"
                  variant="secondary"
                  size="large"
                  onPress={onSupport}
                >
                  {intl.formatMessage({ id: ETranslations.global_support })}
                </Button>
              ) : null}
            </YStack>
          ) : null}
        </YStack>
      </YStack>
    </YStack>
  );
}
