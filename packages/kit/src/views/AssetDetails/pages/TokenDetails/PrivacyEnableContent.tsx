import { useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  DatePicker,
  Dialog,
  Input,
  Radio,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';

import {
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
  const minHeight = Math.max(1, earliestBirthday?.height ?? 1);
  const minimumHeightLabel = `${intl.formatMessage({ id: ETranslations.global_block_height })} ≥ ${intl.formatNumber(minHeight)}`;

  return (
    <YStack gap="$4">
      <Radio
        testID="privacy-sync-start-choice"
        value={choice}
        gap="$3"
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
        options={[
          {
            value: 'today',
            label: intl.formatMessage({
              id: ETranslationsMock.privacy_sync_start_new__title,
              defaultMessage: ETranslationsMock.privacy_sync_start_new__title,
            }),
            description: intl.formatMessage({
              id: ETranslationsMock.privacy_sync_start_new__desc,
              defaultMessage: ETranslationsMock.privacy_sync_start_new__desc,
            }),
          },
          {
            value: 'date',
            label: intl.formatMessage({
              id: ETranslationsMock.privacy_sync_start_used__title,
              defaultMessage: ETranslationsMock.privacy_sync_start_used__title,
            }),
            description: intl.formatMessage({
              id: ETranslationsMock.privacy_sync_start_used__desc,
              defaultMessage: ETranslationsMock.privacy_sync_start_used__desc,
            }),
            children:
              choice === 'date' ? (
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
              ) : undefined,
          },
          ...(earliestDate
            ? [
                {
                  value: 'earliest',
                  label: intl.formatMessage({
                    id: ETranslationsMock.privacy_sync_start_unknown__title,
                    defaultMessage:
                      ETranslationsMock.privacy_sync_start_unknown__title,
                  }),
                  description: intl.formatMessage({
                    id: ETranslationsMock.privacy_sync_start_unknown__desc,
                    defaultMessage:
                      ETranslationsMock.privacy_sync_start_unknown__desc,
                  }),
                },
              ]
            : []),
          ...(advanced
            ? [
                {
                  value: 'height',
                  label: intl.formatMessage({
                    id: ETranslations.global_block_height,
                  }),
                  children:
                    choice === 'height' ? (
                      <YStack pt="$3" gap="$1">
                        <Input
                          testID="privacy-sync-start-height"
                          size="small"
                          keyboardType="number-pad"
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
                        />
                        {invalidHeight ? (
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
                                id: ETranslationsMock.privacy_sync_start_height_invalid__msg,
                                defaultMessage:
                                  ETranslationsMock.privacy_sync_start_height_invalid__msg,
                              }),
                              format: (value) => intl.formatNumber(value),
                            })}
                          </SizableText>
                        ) : null}
                      </YStack>
                    ) : undefined,
                },
              ]
            : []),
        ]}
      />
      <Button
        testID="privacy-sync-start-advanced"
        alignSelf="flex-start"
        size="small"
        variant="tertiary"
        iconAfter={advanced ? 'ChevronTopOutline' : 'ChevronDownSmallOutline'}
        onPress={() => {
          if (advanced && choice === 'height') selectChoice('date');
          setAdvanced(!advanced);
        }}
      >
        {intl.formatMessage({ id: ETranslations.global_advanced })}
      </Button>
      <Dialog.Footer
        onConfirmText={intl.formatMessage({ id: ETranslations.action_save })}
        onConfirm={({ preventClose }) => {
          setHeightTouched(true);
          if (
            !readEnableBirthday(formRef.current, earliestBirthday, networkId)
          ) {
            if (formRef.current.mode !== 'height') {
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
    today: ETranslationsMock.privacy_sync_start_new__title,
    earliest: ETranslationsMock.privacy_sync_start_unknown__title,
    date: ETranslationsMock.privacy_sync_start_used__title,
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
            defaultMessage: summaryTitle,
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
