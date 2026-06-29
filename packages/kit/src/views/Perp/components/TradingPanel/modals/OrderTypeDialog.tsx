import { useCallback } from 'react';
import type { ComponentProps } from 'react';

import type { useInPageDialog } from '@onekeyhq/components';
import {
  Dialog,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { deferHeavyWorkUntilUIIdle } from '@onekeyhq/kit/src/utils/deferHeavyWork';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { PerpsProviderMirror } from '../../../PerpsProviderMirror';
import { PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS } from '../../PerpDialogLayout';

export type IOrderTypeDialogOption = {
  description: string;
  icon: ComponentProps<typeof Icon>['name'];
  label: string;
  value: string;
};

interface IOrderTypeDialogContentProps {
  onClose?: () => void;
  onSelect: (value: string) => void;
  options: IOrderTypeDialogOption[];
  selectedValue: string;
}

function OrderTypeDialogContent({
  options,
  selectedValue,
  onSelect,
  onClose,
}: IOrderTypeDialogContentProps) {
  const handleSelect = useCallback(
    async (value: string) => {
      onClose?.();
      await deferHeavyWorkUntilUIIdle({
        minFrames: platformEnv.isNative ? 3 : 1,
      });
      onSelect(value);
    },
    [onClose, onSelect],
  );

  return (
    <YStack gap="$1">
      {options.map((option) => (
        <XStack
          key={option.value}
          onPress={() => handleSelect(option.value)}
          alignItems="center"
          gap="$2.5"
          px="$0"
          py="$3"
          testID={`perp-order-type-option-${option.value}`}
          cursor="pointer"
        >
          <Stack
            width={32}
            height={32}
            alignItems="center"
            justifyContent="center"
            flexShrink={0}
          >
            <Icon name={option.icon} width={28} height={28} color="$text" />
          </Stack>
          <YStack flex={1} gap="$1">
            <SizableText size="$bodyMdMedium" fontWeight="600" color="$text">
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

export function showOrderTypeDialog({
  title,
  options,
  selectedValue,
  onSelect,
  dialog,
}: {
  dialog?: ReturnType<typeof useInPageDialog>;
  onSelect: (value: string) => void;
  options: IOrderTypeDialogOption[];
  selectedValue: string;
  title: string;
}) {
  const DialogInstance =
    platformEnv.isNativeAndroid || !dialog ? Dialog : dialog;

  const dialogInstance = DialogInstance.show({
    title,
    floatingPanelProps: platformEnv.isNativeAndroid
      ? undefined
      : {
          width: 400,
        },
    renderContent: (
      <PerpsProviderMirror>
        <OrderTypeDialogContent
          options={options}
          selectedValue={selectedValue}
          onSelect={onSelect}
          onClose={() => {
            void dialogInstance.close();
          }}
        />
      </PerpsProviderMirror>
    ),
    contentContainerProps: PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS,
    showFooter: false,
  });

  return dialogInstance;
}
