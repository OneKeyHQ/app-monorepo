import {
  Button,
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components';

import type { IStepState } from './types';

interface IStepRendererProps {
  stepNumber: number;
  title: string;
  state: IStepState;
  onPress: () => void;
  disabled: boolean;
}

export function StepRenderer({
  stepNumber,
  title,
  state,
  onPress,
  disabled,
}: IStepRendererProps) {
  const getStatusIcon = (): IKeyOfIcons => {
    switch (state.status) {
      case 'success':
        return 'CheckRadioOutline';
      case 'error':
        return 'ErrorOutline';
      case 'loading':
        return 'RefreshCcwOutline';
      default:
        return 'CirclePlaceholderOnOutline';
    }
  };

  const getStatusColor = () => {
    switch (state.status) {
      case 'success':
        return '$iconSuccess';
      case 'error':
        return '$iconCritical';
      case 'loading':
        return '$iconSubdued';
      default:
        return '$iconDisabled';
    }
  };

  return (
    <XStack
      gap="$3"
      p="$3"
      borderRadius="$2"
      bg={(() => {
        switch (state.status) {
          case 'success':
            return '$bgSuccessSubdued';
          case 'error':
            return '$bgCriticalSubdued';
          default:
            return '$bgSubdued';
        }
      })()}
      alignItems="center"
    >
      <Icon name={getStatusIcon()} size="$5" color={getStatusColor()} />
      <YStack flex={1} gap="$1">
        <SizableText size="$bodyMd" fontWeight="600">
          Step {stepNumber}: {title}
        </SizableText>
        {(() => {
          if (state.status === 'error' && state.error) {
            return (
              <SizableText size="$bodySm" color="$textCritical">
                Error: {state.error}
              </SizableText>
            );
          }
          if (state.status === 'success') {
            return (
              <SizableText size="$bodySm" color="$textSuccess">
                Success
              </SizableText>
            );
          }
          if (state.status === 'loading') {
            return (
              <SizableText size="$bodySm" color="$textSubdued">
                Loading...
              </SizableText>
            );
          }
          return null;
        })()}
      </YStack>
      <Button
        size="small"
        variant={state.status === 'success' ? 'secondary' : 'primary'}
        disabled={
          disabled || state.status === 'loading' || state.status === 'success'
        }
        onPress={onPress}
      >
        {(() => {
          if (state.status === 'loading') return 'Loading...';
          if (state.status === 'success') return 'Done';
          return 'Execute';
        })()}
      </Button>
    </XStack>
  );
}
