import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { Keyboard, View, type ViewInstance } from 'react-native';

import {
  Checkbox,
  DatePicker,
  Input,
  SegmentControl,
  SizableText,
  YStack,
} from '@onekeyhq/components';
import type { IInputProps } from '@onekeyhq/components';
import { useScrollView } from '@onekeyhq/components/src/layouts/ScrollView';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { IMPL_ZCASH } from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

// The sync start (birthday) form and the enable disclosure for a local-wallet account.

export type IBirthdayFormState = {
  mode: 'saved-birthday' | 'date' | 'height';
  date: Date | null;
  height?: string;
  fromEarliest?: boolean;
  // The chain tip once known; a height above it is not a valid sync start.
  maxHeight?: number;
};

export type IEarliestBirthday = { height: number; timestamp: number };

function getBirthdayCalendarDate(timestamp: number): Date {
  const date = new Date(timestamp);
  // Activation metadata represents a UTC calendar day, not a local instant.
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function createEnableBirthdayForm(
  hintTimestamp?: number,
  earliestBirthday?: IEarliestBirthday,
): {
  current: IBirthdayFormState;
} {
  const now = new Date();
  const suggestedDate =
    typeof hintTimestamp === 'number'
      ? new Date(hintTimestamp)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const earliestDate = earliestBirthday
    ? getBirthdayCalendarDate(earliestBirthday.timestamp)
    : undefined;
  return {
    current: {
      mode: 'date',
      date:
        earliestDate && suggestedDate < earliestDate
          ? earliestDate
          : suggestedDate,
    },
  };
}

export function readEnableBirthday(
  form: IBirthdayFormState,
  earliest: IEarliestBirthday | undefined,
  networkId: string,
): { birthdayHeight?: number; birthdayTimestamp?: number } | undefined {
  if (form.fromEarliest && earliest) {
    return { birthdayHeight: earliest.height };
  }
  if (form.mode === 'height') {
    const value = form.height?.trim() ?? '';
    const height = Number(value);
    // wasm-bindgen passes Zcash heights as u32; larger integers would wrap.
    const exceedsRuntimeHeight =
      networkUtils.getNetworkImpl({ networkId }) === IMPL_ZCASH &&
      height > 4_294_967_295;
    if (
      !/^\d+$/.test(value) ||
      !Number.isSafeInteger(height) ||
      exceedsRuntimeHeight ||
      height < Math.max(1, earliest?.height ?? 1) ||
      (form.maxHeight !== undefined && height > form.maxHeight)
    ) {
      return undefined;
    }
    return { birthdayHeight: height };
  }
  if (form.mode !== 'date') return undefined;
  if (!form.date || !Number.isFinite(form.date.getTime())) return undefined;
  if (earliest && form.date < getBirthdayCalendarDate(earliest.timestamp)) {
    return undefined;
  }
  return {
    birthdayTimestamp: new Date(
      form.date.getFullYear(),
      form.date.getMonth(),
      form.date.getDate(),
    ).getTime(),
  };
}

// A rejected height names the bound it breaks; anything else is just invalid.
export function getBirthdayHeightHint({
  height,
  invalid,
  minHeight,
  maxHeight,
  label,
  invalidText,
  format = (value: number) => value.toLocaleString('en-US'),
}: {
  height: string;
  invalid: boolean;
  minHeight: number;
  maxHeight?: number;
  label: string;
  invalidText: string;
  format?: (value: number) => string;
}): string {
  if (!invalid) {
    return maxHeight === undefined
      ? `${label} ≥ ${format(minHeight)}`
      : `${label} ${format(minHeight)} – ${format(maxHeight)}`;
  }
  const isWholeNumber = /^\d+$/.test(height);
  const value = Number(height);
  if (isWholeNumber && value < minHeight) {
    return `${label} ≥ ${format(minHeight)}`;
  }
  if (isWholeNumber && maxHeight !== undefined && value > maxHeight) {
    return `${label} ≤ ${format(maxHeight)}`;
  }
  return invalidText;
}

export function getBirthdayInputError(mode: IBirthdayFormState['mode']) {
  return mode === 'height'
    ? ETranslations.global_bulk_accounts_page_number_error
    : ETranslations.global_select_date;
}

// Shared by both enable entry points. Repair dialogs must NOT show it: the
// account is already scanning by then.
export function PrivacyEnableDisclosure({
  accountId,
  deviceExportsViewKey,
  hasRecommendedMonth,
}: {
  accountId: string;
  deviceExportsViewKey?: boolean;
  hasRecommendedMonth: boolean;
}) {
  const intl = useIntl();
  return (
    <YStack gap="$3">
      <SizableText size="$bodyMd">
        {intl.formatMessage({
          id: ETranslations.privacy_enable_account__desc,
        })}
      </SizableText>
      {deviceExportsViewKey && accountUtils.isHwAccount({ accountId }) ? (
        <SizableText size="$bodyMd">
          {intl.formatMessage({
            id: ETranslations.privacy_enable_device_view_key__msg,
          })}
        </SizableText>
      ) : null}
      {hasRecommendedMonth ? (
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.privacy_enable_month__desc,
          })}
        </SizableText>
      ) : null}
    </YStack>
  );
}

export function BirthdayHeightInput({
  onFocus,
  onBlur,
  addOns,
  feedback,
  revealRequest,
  ...props
}: IInputProps & { feedback?: ReactNode; revealRequest?: number }) {
  const intl = useIntl();
  const [focused, setFocused] = useState(false);
  const focusedRef = useRef(false);
  const revealWithoutFocusRef = useRef(false);
  const fieldRef = useRef<ViewInstance>(null);
  const frameRef = useRef<ReturnType<typeof requestAnimationFrame> | undefined>(
    undefined,
  );
  const { scrollViewRef, pageOffsetRef } = useScrollView();
  const revealField = useCallback(() => {
    if (
      !platformEnv.isNative ||
      (!focusedRef.current && !revealWithoutFocusRef.current)
    )
      return;
    if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = undefined;
      const field = fieldRef.current;
      const scroll = scrollViewRef.current;
      if (!field || !scroll?.measureInWindow) return;
      // The overlay owns keyboard avoidance; only scroll the field and its error
      // into the remaining body viewport, without adding another keyboard inset.
      scroll.measureInWindow((_x, top, _width, viewportHeight) => {
        field.measureInWindow((_fieldX, fieldTop, _fieldWidth, fieldHeight) => {
          if (
            (!focusedRef.current && !revealWithoutFocusRef.current) ||
            fieldRef.current !== field
          )
            return;
          revealWithoutFocusRef.current = false;
          const bottomOverflow =
            fieldTop + fieldHeight + 8 - (top + viewportHeight);
          const topOverflow = fieldTop - 8 - top;
          const delta =
            topOverflow < 0 ? topOverflow : Math.max(0, bottomOverflow);
          if (Math.abs(delta) > 1) {
            scroll.scrollTo({
              y: Math.max(0, pageOffsetRef.current.y + delta),
              animated: true,
            });
          }
        });
      });
    });
  }, [pageOffsetRef, scrollViewRef]);
  useEffect(() => {
    if (revealRequest) {
      revealWithoutFocusRef.current = true;
      revealField();
    }
  }, [revealField, revealRequest]);
  useEffect(() => {
    if (!platformEnv.isNative) return;
    const shown = Keyboard.addListener('keyboardDidShow', revealField);
    const changed = Keyboard.addListener('keyboardDidChangeFrame', revealField);
    return () => {
      focusedRef.current = false;
      revealWithoutFocusRef.current = false;
      shown.remove();
      changed.remove();
      if (frameRef.current !== undefined)
        cancelAnimationFrame(frameRef.current);
    };
  }, [revealField]);

  return (
    <View ref={fieldRef} onLayout={revealField}>
      <Input
        {...props}
        testID={props.testID}
        keyboardType="number-pad"
        onFocus={(event) => {
          focusedRef.current = true;
          setFocused(true);
          onFocus?.(event);
          revealField();
        }}
        onBlur={(event) => {
          focusedRef.current = false;
          setFocused(false);
          onBlur?.(event);
        }}
        addOns={
          platformEnv.isNative && focused && !props.disabled
            ? [
                ...(addOns ?? []),
                {
                  iconName: 'KeyboardDownOutline',
                  testID: props.testID
                    ? `${props.testID}-hide-keyboard`
                    : undefined,
                  accessibilityRole: 'button',
                  accessibilityLabel: intl.formatMessage({
                    id: ETranslations.global_done,
                  }),
                  onPress: () => Keyboard.dismiss(),
                },
              ]
            : addOns
        }
      />
      <YStack
        testID={props.testID ? `${props.testID}-feedback` : undefined}
        pt="$1"
        minHeight="$6"
        onLayout={revealField}
      >
        {feedback}
      </YStack>
    </View>
  );
}

export function BirthdayDialogForm({
  networkId,
  formRef,
  currentBirthdayHeight,
  allowSavedBirthday = true,
  earliestBirthday,
}: {
  networkId: string;
  formRef: { current: IBirthdayFormState };
  currentBirthdayHeight?: number;
  allowSavedBirthday?: boolean;
  earliestBirthday?: IEarliestBirthday;
}) {
  const intl = useIntl();
  const [mode, setMode] = useState(formRef.current.mode);
  const [fromEarliest, setFromEarliest] = useState(
    formRef.current.fromEarliest ?? false,
  );
  const [date, setDate] = useState(formRef.current.date);
  const [height, setHeight] = useState(formRef.current.height ?? '');
  const [heightTouched, setHeightTouched] = useState(false);
  const locked = fromEarliest && !!earliestBirthday;
  const displayedMode = locked && mode === 'saved-birthday' ? 'date' : mode;
  const earliestDate = earliestBirthday
    ? getBirthdayCalendarDate(earliestBirthday.timestamp)
    : undefined;
  const minDate = earliestDate ?? new Date(2022, 4, 1);
  const displayedHeight = locked ? String(earliestBirthday.height) : height;
  const displayedBirthdayHeight = locked
    ? earliestBirthday.height
    : currentBirthdayHeight;
  // Shown without waiting; the upper bound applies once the tip is known.
  const { result: chainTip } = usePromiseResult(
    () =>
      backgroundApiProxy.servicePrivacyChain.getLocalWalletLatestHeight({
        networkId,
      }),
    [networkId],
  );
  const maxHeight = chainTip ?? undefined;
  useEffect(() => {
    formRef.current.maxHeight = maxHeight;
  }, [formRef, maxHeight]);
  const invalidHeight =
    !locked &&
    height.length > 0 &&
    !readEnableBirthday(
      { mode: 'height', date: null, height, maxHeight },
      earliestBirthday,
      networkId,
    );
  const showHeightError =
    displayedMode === 'height' && heightTouched && invalidHeight;
  const minHeight = Math.max(1, earliestBirthday?.height ?? 1);
  // A defined `disabled`, even false, reaches the input through Tamagui Group
  // and makes the read-only field editable on Android.
  const dateDisabled = locked ? true : undefined;
  let editor: React.ReactNode = null;
  if (displayedMode === 'date') {
    editor = (
      <YStack testID="local-wallet-birthday-date-input">
        <DatePicker
          title={intl.formatMessage({
            id: ETranslations.global_select_date,
          })}
          placeholder={intl.formatMessage({
            id: ETranslations.global_select_date,
          })}
          minDate={minDate}
          maxDate={new Date()}
          disabled={dateDisabled}
          showTodayShortcut={false}
          value={locked ? earliestDate : date}
          onChange={(value) => {
            if (locked) return;
            setDate(value);
            formRef.current.date = value;
          }}
        />
      </YStack>
    );
  } else if (displayedMode === 'height') {
    editor = (
      <BirthdayHeightInput
        testID="local-wallet-birthday-height-input"
        size="small"
        keyboardType="number-pad"
        placeholder={intl.formatMessage({
          id: ETranslations.global_block_height,
        })}
        value={displayedHeight}
        disabled={locked}
        error={showHeightError}
        feedback={
          showHeightError ? (
            <SizableText
              testID="local-wallet-birthday-height-error"
              size="$bodySm"
              color="$textCritical"
              accessibilityRole="alert"
            >
              {getBirthdayHeightHint({
                height: height.trim(),
                invalid: true,
                minHeight,
                maxHeight,
                label: intl.formatMessage({
                  id: ETranslations.global_block_height,
                }),
                invalidText: intl.formatMessage({
                  id: getBirthdayInputError('height'),
                }),
                format: (value) => intl.formatNumber(value),
              })}
            </SizableText>
          ) : null
        }
        onBlur={() => setHeightTouched(true)}
        onChangeText={(value) => {
          if (locked) return;
          setHeight(value);
          formRef.current.height = value;
        }}
      />
    );
  }

  return (
    <YStack gap="$3">
      {typeof currentBirthdayHeight === 'number' ? (
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage(
            {
              id: ETranslations.privacy_sync_start_block__title,
            },
            {
              height: intl.formatNumber(
                displayedBirthdayHeight ?? currentBirthdayHeight,
              ),
            },
          )}
        </SizableText>
      ) : null}
      <SegmentControl
        testID="local-wallet-birthday-mode"
        fullWidth
        value={displayedMode}
        pointerEvents={locked ? 'none' : 'auto'}
        aria-disabled={locked}
        onChange={(v) => {
          if (locked) return;
          const next = v as IBirthdayFormState['mode'];
          setMode(next);
          formRef.current.mode = next;
        }}
        options={[
          ...(allowSavedBirthday
            ? [
                {
                  label: intl.formatMessage({
                    id: ETranslations.privacy_sync_start_saved__title,
                  }),
                  value: 'saved-birthday',
                  testID: 'local-wallet-birthday-mode-saved',
                  disabled: locked,
                },
              ]
            : []),
          {
            label: intl.formatMessage({ id: ETranslations.global_date }),
            value: 'date',
            testID: 'local-wallet-birthday-mode-date',
            disabled: locked,
          },
          {
            label: intl.formatMessage({
              id: ETranslations.global_block_height,
            }),
            value: 'height',
            testID: 'local-wallet-birthday-mode-height',
            disabled: locked,
          },
        ]}
      />
      {editor ? <YStack gap="$1">{editor}</YStack> : null}
      {earliestBirthday ? (
        <YStack gap="$1">
          <Checkbox
            testID="local-wallet-birthday-from-earliest"
            value={fromEarliest}
            onChange={(checked) => {
              const next = Boolean(checked);
              setFromEarliest(next);
              formRef.current.fromEarliest = next;
            }}
            label={intl.formatMessage({
              id: ETranslations.privacy_sync_start_from_beginning__desc,
            })}
            containerProps={{ py: '$0', mt: '$1' }}
            labelProps={{ variant: '$bodyMd', color: '$textSubdued' }}
            labelContainerProps={{ flex: 1 }}
          />
        </YStack>
      ) : null}
    </YStack>
  );
}
