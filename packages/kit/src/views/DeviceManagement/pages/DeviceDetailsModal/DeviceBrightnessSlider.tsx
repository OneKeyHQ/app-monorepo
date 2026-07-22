import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  SegmentSlider,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { DeviceManagementTestIDs } from '../../testIDs';

const MIN_BRIGHTNESS = 10;
const MAX_BRIGHTNESS = 100;
const BRIGHTNESS_WRITE_DEBOUNCE_MS = 300;

export function normalizeDeviceBrightness(value: number) {
  return Math.min(MAX_BRIGHTNESS, Math.max(MIN_BRIGHTNESS, Math.round(value)));
}

export function useDeviceBrightnessSlider({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (value: number) => Promise<void>;
}) {
  const normalizedValue = normalizeDeviceBrightness(value);
  const [displayValue, setDisplayValue] = useState(normalizedValue);
  const displayValueRef = useRef(normalizedValue);
  const confirmedValueRef = useRef(normalizedValue);
  const onCommitRef = useRef(onCommit);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const scheduledRef = useRef<{ revision: number; value: number }>();
  const latestRevisionRef = useRef(0);
  const settledRevisionRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  useEffect(() => {
    confirmedValueRef.current = normalizedValue;
    if (latestRevisionRef.current === settledRevisionRef.current) {
      displayValueRef.current = normalizedValue;
      setDisplayValue(normalizedValue);
    }
  }, [normalizedValue]);

  const commit = useCallback(
    async ({ revision, value: next }: { revision: number; value: number }) => {
      try {
        await onCommitRef.current(next);
        if (revision === latestRevisionRef.current) {
          settledRevisionRef.current = revision;
        }
      } catch {
        if (revision === latestRevisionRef.current && mountedRef.current) {
          settledRevisionRef.current = revision;
          displayValueRef.current = confirmedValueRef.current;
          setDisplayValue(confirmedValueRef.current);
        }
      }
    },
    [],
  );

  const clearScheduledCommit = useCallback(() => {
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  const handleChange = useCallback(
    (nextValue: number) => {
      const next = normalizeDeviceBrightness(nextValue);
      if (next === displayValueRef.current) return;

      displayValueRef.current = next;
      setDisplayValue(next);
      latestRevisionRef.current += 1;
      scheduledRef.current = {
        revision: latestRevisionRef.current,
        value: next,
      };

      clearScheduledCommit();
      timerRef.current = setTimeout(() => {
        timerRef.current = undefined;
        const scheduled = scheduledRef.current;
        scheduledRef.current = undefined;
        if (scheduled) {
          void commit(scheduled);
        }
      }, BRIGHTNESS_WRITE_DEBOUNCE_MS);
    },
    [clearScheduledCommit, commit],
  );

  const handleSlideComplete = useCallback(() => {
    const scheduled = scheduledRef.current;
    if (!scheduled) return;

    clearScheduledCommit();
    scheduledRef.current = undefined;
    void commit(scheduled);
  }, [clearScheduledCommit, commit]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearScheduledCommit();
      scheduledRef.current = undefined;
    };
  }, [clearScheduledCommit]);

  return {
    displayValue,
    handleChange,
    handleSlideComplete,
  };
}

export function DeviceBrightnessSlider({
  value,
  disabled,
  onCommit,
}: {
  value: number;
  disabled?: boolean;
  onCommit: (value: number) => Promise<void>;
}) {
  const intl = useIntl();
  const { displayValue, handleChange, handleSlideComplete } =
    useDeviceBrightnessSlider({ value, onCommit });

  return (
    <YStack
      px="$5"
      py="$3"
      gap="$3"
      opacity={disabled ? 0.5 : 1}
      testID={DeviceManagementTestIDs.brightnessItem}
    >
      <XStack alignItems="center" justifyContent="space-between">
        <SizableText size="$bodyMdMedium" color="$text">
          {intl.formatMessage({ id: ETranslations.global_brightness })}
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {displayValue}%
        </SizableText>
      </XStack>
      <SegmentSlider
        value={displayValue}
        min={MIN_BRIGHTNESS}
        max={MAX_BRIGHTNESS}
        segments={4}
        sliderHeight={4}
        showBubble
        disabled={disabled}
        onChange={handleChange}
        onSlideComplete={handleSlideComplete}
      />
    </YStack>
  );
}
