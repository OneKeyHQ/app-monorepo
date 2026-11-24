import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { Keyboard } from 'react-native';
import { Easing } from 'react-native-reanimated';

import {
  Button,
  DatePicker,
  Dialog,
  HeightTransition,
  Radio,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  BirthdayHeightInput,
  PrivacyEnableDisclosure,
  createEnableBirthdayForm,
  getBirthdayHeightHint,
  getBirthdayInputError,
  readEnableBirthday,
} from './LocalWalletRepairControls';

import type {
  IBirthdayFormState,
  IEarliestBirthday,
} from './LocalWalletRepairControls';

const expansionEasing = Easing.out(Easing.cubic);

type IStartChoice = 'today' | 'date' | 'earliest' | 'height';
type IFormRef = {
  current: IBirthdayFormState & { startChoice?: IStartChoice };
};

function earliestCalendarDate(earliest: IEarliestBirthday): Date {
  const date = new Date(earliest.timestamp);
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function validHint(timestamp?: number): number | undefined {
  return typeof timestamp === 'number' &&
    Number.isFinite(timestamp) &&
    timestamp <= Date.now()
    ? timestamp
    : undefined;
}

export function createPrivacyEnableForm({
  earliestBirthday,
}: {
  earliestBirthday?: IEarliestBirthday;
}): IFormRef {
  return {
    current: {
      ...createEnableBirthdayForm(undefined, earliestBirthday).current,
      startChoice: 'today',
    },
  };
}

function PrivacySyncStartEditor({
  networkId,
  formRef,
  earliestBirthday,
  suggestedDate,
  onSave,
}: {
  networkId: string;
  formRef: IFormRef;
  earliestBirthday?: IEarliestBirthday;
  suggestedDate?: Date;
  onSave: () => void;
}) {
  const intl = useIntl();
  const [date, setDate] = useState(
    formRef.current.startChoice === 'today'
      ? (suggestedDate ?? formRef.current.date)
      : formRef.current.date,
  );
  const [height, setHeight] = useState(formRef.current.height ?? '');
  const [heightTouched, setHeightTouched] = useState(false);
  const [heightRevealRequest, setHeightRevealRequest] = useState(0);
  const [advanced, setAdvanced] = useState(formRef.current.mode === 'height');
  const [choice, setChoice] = useState<IStartChoice>(() => {
    if (formRef.current.fromEarliest && earliestBirthday) return 'earliest';
    if (formRef.current.mode === 'height') return 'height';
    return formRef.current.startChoice ?? 'date';
  });
  const earliestDate = earliestBirthday
    ? earliestCalendarDate(earliestBirthday)
    : undefined;
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
  const selectChoice = (value: IStartChoice) => {
    setChoice(value);
    formRef.current = {
      mode: value === 'height' ? 'height' : 'date',
      date:
        value === 'today'
          ? createEnableBirthdayForm(undefined, earliestBirthday).current.date
          : date,
      height,
      fromEarliest: value === 'earliest',
      startChoice: value,
      maxHeight,
    };
  };
  const invalidHeight =
    choice === 'height' &&
    heightTouched &&
    !readEnableBirthday(
      { ...formRef.current, maxHeight },
      earliestBirthday,
      networkId,
    );
  const invalidHeightRef = useRef(invalidHeight);
  useEffect(() => {
    invalidHeightRef.current = invalidHeight;
  }, [invalidHeight]);
  const revealHeightError = useCallback(() => {
    if (invalidHeightRef.current) {
      setHeightRevealRequest((request) => request + 1);
    }
  }, []);
  const minHeight = Math.max(1, earliestBirthday?.height ?? 1);
  const minimumHeightLabel = `${intl.formatMessage({ id: ETranslations.global_block_height })} ≥ ${intl.formatNumber(minHeight)}`;

  return (
    <YStack gap="$4">
      <Radio
        testID="privacy-sync-start-choice"
        value={choice}
        gap="$3"
        itemAlign="start"
        onChange={(value) => {
          if (
            value === 'today' ||
            value === 'date' ||
            value === 'earliest' ||
            value === 'height'
          ) {
            selectChoice(value);
          }
        }}
        renderItem={(item, option) =>
          option.value === 'height' ? (
            <YStack gap="$3" alignSelf="stretch">
              <Button
                testID="privacy-sync-start-advanced"
                alignSelf="flex-start"
                size="small"
                variant="tertiary"
                iconAfter={
                  advanced ? 'ChevronTopOutline' : 'ChevronDownSmallOutline'
                }
                onPress={() => {
                  if (advanced) Keyboard.dismiss();
                  setAdvanced(!advanced);
                }}
              >
                {intl.formatMessage({ id: ETranslations.global_advanced })}
              </Button>
              {!advanced && choice === 'height' ? (
                <SizableText
                  testID="privacy-sync-start-collapsed-height"
                  size="$bodySm"
                  color="$textSubdued"
                >
                  {intl.formatMessage({
                    id: ETranslations.global_block_height,
                  })}
                  {height.trim() ? `: ${height.trim()}` : ''}
                </SizableText>
              ) : null}
              <HeightTransition
                duration={240}
                opacityDuration={160}
                easing={expansionEasing}
                roundHeightToNearestPixel
                onHeightDidAnimate={revealHeightError}
              >
                {advanced ? item : null}
              </HeightTransition>
            </YStack>
          ) : (
            item
          )
        }
        options={[
          {
            value: 'today',
            label: intl.formatMessage({
              id: ETranslations.privacy_sync_start_new__title,
            }),
            description: intl.formatMessage({
              id: ETranslations.privacy_sync_start_new__desc,
            }),
          },
          {
            value: 'date',
            label: intl.formatMessage({
              id: ETranslations.privacy_sync_start_used__title,
            }),
            description: intl.formatMessage({
              id: ETranslations.privacy_sync_start_used__desc,
            }),
            children: (
              <HeightTransition
                duration={240}
                opacityDuration={160}
                easing={expansionEasing}
                roundHeightToNearestPixel
              >
                {choice === 'date' ? (
                  <YStack pt="$3">
                    <DatePicker
                      title={intl.formatMessage({
                        id: ETranslations.global_select_date,
                      })}
                      value={date}
                      minDate={earliestDate}
                      maxDate={new Date()}
                      showTodayShortcut={false}
                      onChange={(next) => {
                        setDate(next);
                        formRef.current.date = next;
                      }}
                    />
                  </YStack>
                ) : null}
              </HeightTransition>
            ),
          },
          ...(earliestDate
            ? [
                {
                  value: 'earliest',
                  label: intl.formatMessage({
                    id: ETranslations.privacy_sync_start_unknown__title,
                  }),
                  description: intl.formatMessage({
                    id: ETranslations.privacy_sync_start_unknown__desc,
                  }),
                },
              ]
            : []),
          {
            value: 'height',
            label: intl.formatMessage({
              id: ETranslations.global_block_height,
            }),
            children:
              choice === 'height' ? (
                <YStack pt="$3">
                  <BirthdayHeightInput
                    testID="privacy-sync-start-height"
                    size="small"
                    revealRequest={heightRevealRequest}
                    placeholder={minimumHeightLabel}
                    value={height}
                    error={!!invalidHeight}
                    onBlur={() => {
                      if (height.trim()) setHeightTouched(true);
                    }}
                    onChangeText={(value) => {
                      setHeight(value);
                      formRef.current.height = value;
                    }}
                    feedback={
                      invalidHeight ? (
                        <SizableText
                          testID="privacy-sync-start-height-error"
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
                              id: ETranslations.privacy_sync_start_height_invalid__msg,
                            }),
                            format: (value) => intl.formatNumber(value),
                          })}
                        </SizableText>
                      ) : null
                    }
                  />
                </YStack>
              ) : null,
          },
        ]}
      />
      <Dialog.Footer
        onConfirmText={intl.formatMessage({ id: ETranslations.action_save })}
        onConfirm={({ preventClose }) => {
          setHeightTouched(true);
          if (
            !readEnableBirthday(formRef.current, earliestBirthday, networkId)
          ) {
            if (formRef.current.mode === 'height') {
              setAdvanced(true);
              setHeightRevealRequest((request) => request + 1);
            } else {
              Toast.error({
                title: intl.formatMessage({
                  id: getBirthdayInputError(formRef.current.mode),
                }),
              });
            }
            preventClose();
            return;
          }
          onSave();
        }}
      />
    </YStack>
  );
}

export function PrivacyEnableContent({
  networkId,
  accountId,
  deviceExportsViewKey,
  formRef,
  earliestBirthday,
  birthdayHintTimestamp,
}: {
  networkId: string;
  accountId: string;
  deviceExportsViewKey?: boolean;
  formRef: IFormRef;
  earliestBirthday?: IEarliestBirthday;
  birthdayHintTimestamp?: number;
}) {
  const intl = useIntl();
  const [, refreshSummary] = useState(0);
  const hint = validHint(birthdayHintTimestamp);
  const suggestedDate =
    hint === undefined
      ? undefined
      : (createEnableBirthdayForm(hint, earliestBirthday).current.date ??
        undefined);
  const form = formRef.current;
  let choice = form.startChoice ?? 'date';
  if (form.fromEarliest) choice = 'earliest';
  else if (form.mode === 'height') choice = 'height';
  const summaryTitle = {
    today: ETranslations.privacy_sync_start_new__title,
    earliest: ETranslations.privacy_sync_start_unknown__title,
    date: ETranslations.privacy_sync_start_used__title,
    height: ETranslations.global_block_height,
  }[choice];

  const editStart = () => {
    // The secondary dialog owns a draft; closing it must not alter the enable request.
    const draftRef: IFormRef = {
      current: {
        ...formRef.current,
        date: formRef.current.date ? new Date(formRef.current.date) : null,
      },
    };
    Dialog.show({
      title: intl.formatMessage({
        id: ETranslations.privacy_sync_start__title,
      }),
      showConfirmButton: true,
      showCancelButton: true,
      boundedSheetLayout: true,
      fixedHeaderFooterHeight: 600,
      sheetDragArea: 'header',
      renderContent: (
        <PrivacySyncStartEditor
          networkId={networkId}
          formRef={draftRef}
          earliestBirthday={earliestBirthday}
          suggestedDate={suggestedDate}
          onSave={() => {
            formRef.current = { ...draftRef.current };
            refreshSummary((revision) => revision + 1);
          }}
        />
      ),
      onConfirmText: intl.formatMessage({ id: ETranslations.action_save }),
    });
  };

  return (
    <YStack gap="$4">
      <PrivacyEnableDisclosure
        accountId={accountId}
        deviceExportsViewKey={deviceExportsViewKey}
        hasRecommendedMonth={false}
      />
      <XStack
        testID="privacy-enable-start-summary"
        p="$4"
        borderWidth={1}
        borderColor="$borderSubdued"
        borderRadius="$3"
        alignItems="center"
        gap="$3"
      >
        <SizableText flex={1} size="$bodyMdMedium">
          {intl.formatMessage({
            id: summaryTitle,
          })}
        </SizableText>
        <Button
          testID="privacy-enable-edit-start"
          size="small"
          variant="tertiary"
          onPress={editStart}
        >
          {intl.formatMessage({ id: ETranslations.global_edit })}
        </Button>
      </XStack>
    </YStack>
  );
}
