import { useCallback, useEffect, useState } from 'react';

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

import { AUTH_FAILURE_TEXT, AUTH_NOTE_TEXT } from './stepCopy';
import { StepText } from './StepText';

import type { IAuthChecklistItem, IAuthFailureReason } from './type';

/**
 * The authenticity flow's own furniture, shared by both engines. The
 * checklist is the new-firmware verification played out line by line —
 * the driver owns the rows and their progress, the stage only renders
 * them: a row is pending (dim ring), in progress (spinner + label),
 * verified (green check, the result value — linked to its release page
 * when one exists), or failed (red cross + Failed). The failure card
 * fronts a critical icon where the staged steps front the replica, and
 * its recoverable shape gates Continue-anyway behind the NOTE beat: the
 * card's content swaps in place — per the ratified design, a
 * replacement, not the old in-place expansion — and Back returns
 * without leaving the step.
 */

/** The verifying label the live checklist shows on the active row. */
const ROW_IN_PROGRESS = 'In progress';
/** And the failed row's verdict. */
const ROW_FAILED = 'Failed';

function ChecklistRow({ item }: { item: IAuthChecklistItem }) {
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
        <SizableText size="$bodyMd">{ROW_IN_PROGRESS}</SizableText>
      ) : null}
      {item.status === 'failed' ? (
        <SizableText size="$bodyMd" color="$textCritical">
          {ROW_FAILED}
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
  onContinueAnyway,
  resetSignal,
}: {
  reason?: IAuthFailureReason;
  /** The rows that ended in failure — the unofficial-firmware shape. */
  checklist?: IAuthChecklistItem[];
  onSupport?: () => void;
  onRetry?: () => void;
  onContinueAnyway?: () => void;
  /** Fresh-visit signal, the app inputs' own: parked presenters bump it
   * per activation so a revisit opens on the failure, not a stale NOTE. */
  resetSignal?: number;
}) {
  const copy = AUTH_FAILURE_TEXT[reason];
  const [noteShown, setNoteShown] = useState(false);
  useEffect(() => {
    setNoteShown(false);
  }, [resetSignal]);
  const showNote = useCallback(() => setNoteShown(true), []);
  const hideNote = useCallback(() => setNoteShown(false), []);

  if (noteShown) {
    return (
      <YStack>
        {/* The NOTE beat carries no icon; its warning line wears
            critical on the words' own metrics. The words block's own
            bottom padding is the gap to the buttons. */}
        <StepText
          title={AUTH_NOTE_TEXT.title}
          sub={AUTH_NOTE_TEXT.sub}
          subColor="$textCritical"
          animated={false}
        />
        <YStack gap="$2">
          <Button
            testID="device-stage-auth-continue-anyway"
            variant="secondary"
            size="large"
            onPress={onContinueAnyway}
          >
            {AUTH_NOTE_TEXT.confirm}
          </Button>
          <Button
            testID="device-stage-auth-note-back"
            variant="secondary"
            size="large"
            onPress={hideNote}
          >
            {AUTH_NOTE_TEXT.back}
          </Button>
        </YStack>
      </YStack>
    );
  }

  return (
    <YStack gap="$6">
      <Stack alignSelf="center" p="$4" borderRadius="$full" bg="$bgCritical">
        <Icon name={copy.icon} size="$10" color="$iconCritical" />
      </Stack>
      {/* The words block's own bottom padding is its gap to what
          follows; the blocks after it keep the card's 24. */}
      <YStack>
        <StepText title={copy.title} sub={copy.sub} animated={false} />
        <YStack gap="$6">
          {checklist?.length ? <AuthChecklist items={checklist} /> : null}
          {copy.action === 'support' && onSupport ? (
            <Button
              testID="device-stage-auth-support"
              variant="primary"
              size="large"
              onPress={onSupport}
            >
              Support
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
                Retry
              </Button>
              <Button
                testID="device-stage-auth-note-open"
                variant="secondary"
                size="large"
                onPress={showNote}
              >
                Continue anyway
              </Button>
            </YStack>
          ) : null}
        </YStack>
      </YStack>
    </YStack>
  );
}
