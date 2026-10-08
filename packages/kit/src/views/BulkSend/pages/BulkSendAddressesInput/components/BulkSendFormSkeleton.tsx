import { SizableText, Skeleton, YStack } from '@onekeyhq/components';
import { EBulkSendMode } from '@onekeyhq/shared/types/bulkSend';

// Mirrors LineNumberedTextArea: 2 text lines + vertical padding for the
// single-line field, the multi-line minimum height otherwise, plus the
// paste / selector action row underneath.
const SINGLE_LINE_FIELD_HEIGHT = 24 * 2 + 12 * 2;
const MULTI_LINE_FIELD_HEIGHT = 120;
const ACTION_ROW_HEIGHT = 52;

function FieldSkeleton({
  label,
  fieldHeight,
  withDescription,
}: {
  label: string;
  fieldHeight: number;
  withDescription?: boolean;
}) {
  return (
    <YStack testID="bulk-send-field-skeleton">
      <SizableText size="$bodyMdMedium" mb="$1.5">
        {label}
      </SizableText>
      <Skeleton
        w="100%"
        h={fieldHeight + ACTION_ROW_HEIGHT}
        radius={12}
        // Keep the box the same tone as the real bordered input so the
        // swap to the live field does not read as a color flash.
        bg="$bgSubdued"
      />
      {withDescription ? <Skeleton.BodyMd width="$40" mt="$1.5" /> : null}
    </YStack>
  );
}

/**
 * Size-stable placeholder for the sender field while the page seed is
 * still loading (OK-61587). Only OneToMany seeds a sender address, so the
 * multi-line variants never show it.
 */
export function SenderFieldSkeleton({ label }: { label: string }) {
  return (
    <FieldSkeleton
      label={label}
      fieldHeight={SINGLE_LINE_FIELD_HEIGHT}
      withDescription
    />
  );
}

/**
 * Placeholder for the whole form block while the address-input account
 * selector store hydrates on a cold start, so the asset row does not sit
 * alone on screen until the fields mount.
 */
export function BulkSendFormSkeleton({
  bulkSendMode,
  senderLabel,
  receiverLabel,
}: {
  bulkSendMode: EBulkSendMode;
  senderLabel: string;
  receiverLabel: string;
}) {
  const isOneToMany = bulkSendMode === EBulkSendMode.OneToMany;
  const isManyToOne = bulkSendMode === EBulkSendMode.ManyToOne;
  return (
    <YStack gap="$5" testID="bulk-send-form-skeleton">
      <FieldSkeleton
        label={senderLabel}
        fieldHeight={
          isOneToMany ? SINGLE_LINE_FIELD_HEIGHT : MULTI_LINE_FIELD_HEIGHT
        }
        withDescription={isOneToMany}
      />
      <FieldSkeleton
        label={receiverLabel}
        fieldHeight={
          isManyToOne ? SINGLE_LINE_FIELD_HEIGHT : MULTI_LINE_FIELD_HEIGHT
        }
      />
    </YStack>
  );
}
