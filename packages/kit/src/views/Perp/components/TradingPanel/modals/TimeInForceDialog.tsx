import { useCallback } from 'react';

import type { useInPageDialog } from '@onekeyhq/components';
import {
  Dialog,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ITIF } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS } from '../../PerpDialogLayout';

export type ITimeInForceDialogOption = {
  description: string;
  label: string;
  value: ITIF;
};

interface ITimeInForceDialogContentProps {
  onClose?: () => void;
  onSelect: (value: ITIF) => void;
  options: ITimeInForceDialogOption[];
  selectedValue: ITIF;
  testID?: string;
}

function TimeInForceDialogContent({
  options,
  selectedValue,
  onSelect,
  onClose,
  testID,
}: ITimeInForceDialogContentProps) {
  const handleSelect = useCallback(
    (value: ITIF) => {
      onSelect(value);
      onClose?.();
    },
    [onClose, onSelect],
  );

  return (
    <YStack gap="$3">
      {options.map((option) => (
        <XStack
          key={option.value}
          testID={testID ? `${testID}-option-${option.value}` : undefined}
          alignItems="center"
          gap="$3"
          p="$4"
          borderRadius="$3"
          borderWidth="$px"
          borderColor={
            selectedValue === option.value ? '$borderActive' : '$borderSubdued'
          }
          cursor="pointer"
          onPress={() => handleSelect(option.value)}
          hoverStyle={{
            borderColor:
              selectedValue === option.value
                ? '$borderActive'
                : '$borderStrong',
          }}
          pressStyle={{ borderColor: '$borderActive' }}
        >
          <YStack flex={1} minWidth={0} gap="$1">
            <SizableText size="$bodyMdMedium" color="$text">
              {option.label}
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued">
              {option.description}
            </SizableText>
          </YStack>
          <Stack width={28} alignItems="flex-end" justifyContent="center">
            {selectedValue === option.value ? (
              <Icon name="CheckRadioSolid" size="$5" color="$iconActive" />
            ) : null}
          </Stack>
        </XStack>
      ))}
    </YStack>
  );
}

export function showTimeInForceDialog({
  title,
  options,
  selectedValue,
  onSelect,
  dialog,
  testID,
}: {
  dialog?: ReturnType<typeof useInPageDialog>;
  onSelect: (value: ITIF) => void;
  options: ITimeInForceDialogOption[];
  selectedValue: ITIF;
  testID?: string;
  title: string;
}) {
  const DialogInstance =
    platformEnv.isNativeAndroid || !dialog ? Dialog : dialog;

  const dialogInstance = DialogInstance.show({
    title,
    renderContent: (
      <TimeInForceDialogContent
        options={options}
        selectedValue={selectedValue}
        onSelect={onSelect}
        onClose={() => {
          void dialogInstance.close();
        }}
        testID={testID}
      />
    ),
    contentContainerProps: PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS,
    showFooter: false,
  });

  return dialogInstance;
}
