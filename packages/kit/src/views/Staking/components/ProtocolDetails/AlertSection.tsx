import { StyleSheet } from 'react-native';

import { SizableText, YStack } from '@onekeyhq/components';

export function AlertSection({ alerts = [] }: { alerts?: string[] }) {
  return alerts.length ? (
    <YStack
      bg="$bgSubdued"
      borderColor="$borderSubdued"
      borderWidth={StyleSheet.hairlineWidth}
    >
      {alerts.map((text, index) => (
        <SizableText key={index} size="$bodyMd" color="$textSubdued">
          {text}
        </SizableText>
      ))}
    </YStack>
  ) : null;
}
