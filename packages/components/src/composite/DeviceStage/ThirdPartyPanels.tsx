import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { Input } from '../../forms/Input';
import {
  Button,
  Icon,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '../../primitives';

/**
 * The third-party track's own panels: the Trezor THP pairing entry (the
 * reverse handoff — the device shows a code, the person types it here)
 * and the Ledger app-install shapes, single progress and queued
 * checklist. Real progress from the vendor SDK, never simulated.
 */

export interface IPairingCodeFormProps {
  onSubmit?: (code: string) => void;
  /**
   * Fresh-visit signal for presenters that keep the form mounted between
   * visits (the overlay's parked panel seats): each change clears the
   * entry — the clean slate a remount used to provide.
   */
  resetSignal?: number;
}

export function PairingCodeForm({
  onSubmit,
  resetSignal,
}: IPairingCodeFormProps) {
  const intl = useIntl();
  const [value, setValue] = useState('');
  const [emptyPrompt, setEmptyPrompt] = useState(false);
  useEffect(() => {
    setValue('');
    setEmptyPrompt(false);
  }, [resetSignal]);
  const handleChange = useCallback((text: string) => {
    setValue(text);
    setEmptyPrompt(false);
  }, []);
  const handleConfirm = useCallback(() => {
    if (!value.trim().length) {
      setEmptyPrompt(true);
      return;
    }
    onSubmit?.(value.trim());
  }, [onSubmit, value]);
  return (
    <YStack gap="$5">
      <YStack gap="$2">
        <Input
          testID="device-stage-pairing-code-input"
          size="large"
          value={value}
          onChangeText={handleChange}
          placeholder={intl.formatMessage({
            id: ETranslations.trezor_thp_pairing_code__desc,
          })}
          keyboardType="number-pad"
          autoCorrect={false}
        />
        {emptyPrompt ? (
          // Refusing an empty confirm: a prompt in place of a disabled
          // button.
          <SizableText size="$bodyMd" color="$textCritical">
            {intl.formatMessage({
              id: ETranslations.device_stage_security_code_first__msg,
            })}
          </SizableText>
        ) : null}
      </YStack>
      <Button
        testID="device-stage-pairing-code-confirm"
        variant="primary"
        size="large"
        onPress={handleConfirm}
      >
        {intl.formatMessage({ id: ETranslations.global_confirm })}
      </Button>
    </YStack>
  );
}

/** A hair-thin track with a live fill — the install steps' progress. */
function ProgressTrack({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <Stack h="$1" borderRadius="$full" bg="$neutral5" overflow="hidden">
      <Stack
        h="100%"
        width={`${clamped}%`}
        borderRadius="$full"
        bg="$bgPrimary"
      />
    </Stack>
  );
}

/** One live row: spinner, name, percent — the install grammar's beat. */
function InstallActiveRow({
  appName,
  percent,
}: {
  appName: string;
  percent: number;
}) {
  return (
    <YStack gap="$2">
      <XStack alignItems="center" gap="$3">
        <Spinner size="small" />
        <SizableText flex={1} size="$bodyLgMedium">
          {appName}
        </SizableText>
        <SizableText size="$bodyMdMedium" color="$textSubdued">
          {`${Math.max(0, Math.min(100, Math.round(percent)))}%`}
        </SizableText>
      </XStack>
      <ProgressTrack percent={percent} />
    </YStack>
  );
}

/** The single install's progress panel — `installing`'s tail. */
export function InstallProgress({
  appName,
  percent,
}: {
  appName?: string;
  percent?: number;
}) {
  return (
    <YStack
      borderRadius="$4"
      borderCurve="continuous"
      bg="$neutral3"
      px="$4"
      py="$3"
    >
      <InstallActiveRow appName={appName ?? 'App'} percent={percent ?? 0} />
    </YStack>
  );
}

/**
 * The queued install's checklist — `installBatch`'s tail. Rows before
 * the active index are done, the active row carries the live progress,
 * rows after wait their turn. The driver owns the queue and the clock.
 */
export function InstallChecklist({
  queue,
  activeIndex,
  percent,
}: {
  queue: string[];
  activeIndex?: number;
  percent?: number;
}) {
  const active = activeIndex ?? 0;
  const rows = useMemo(
    () =>
      queue.map((appName, index) => {
        let state: 'done' | 'active' | 'pending' = 'pending';
        if (index < active) {
          state = 'done';
        } else if (index === active) {
          state = 'active';
        }
        return { appName, state };
      }),
    [active, queue],
  );
  return (
    <YStack
      borderRadius="$4"
      borderCurve="continuous"
      bg="$neutral3"
      px="$4"
      py="$3"
      gap="$4"
    >
      {rows.map((row) => {
        if (row.state === 'active') {
          return (
            <InstallActiveRow
              key={row.appName}
              appName={row.appName}
              percent={percent ?? 0}
            />
          );
        }
        return (
          <XStack key={row.appName} alignItems="center" gap="$3">
            {row.state === 'done' ? (
              <Icon name="CheckRadioSolid" size="$6" color="$iconSuccess" />
            ) : (
              <Icon
                name="CirclePlaceholderOnOutline"
                size="$6"
                color="$iconDisabled"
              />
            )}
            <SizableText
              flex={1}
              size="$bodyLgMedium"
              color={row.state === 'pending' ? '$textDisabled' : '$text'}
            >
              {row.appName}
            </SizableText>
          </XStack>
        );
      })}
    </YStack>
  );
}
