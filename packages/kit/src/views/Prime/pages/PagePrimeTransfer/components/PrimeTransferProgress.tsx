import type { ReactNode } from 'react';

import {
  Icon,
  Progress,
  SizableText,
  Spinner,
  YStack,
} from '@onekeyhq/components';

export const primeTransferProgressDialogProps = {
  title: '',
  showExitButton: true,
  disableDrag: true,
  dismissOnOverlayPress: false,
} as const;

export function PrimeTransferProgress({
  value,
  label,
  description,
  status = 'active',
  testID,
}: {
  value?: number;
  label: ReactNode;
  description?: string;
  status?: 'active' | 'success' | 'error';
  testID: string;
}) {
  return (
    <YStack alignItems="center" testID={testID}>
      {status === 'active' && value === undefined ? (
        <Spinner size="large" mt="$4" />
      ) : null}
      {status === 'active' && value !== undefined ? (
        <Progress mt="$4" w="100%" size="medium" value={value} />
      ) : null}
      {status !== 'active' ? (
        <Icon
          name={status === 'success' ? 'CheckRadioSolid' : 'XCircleSolid'}
          size="$12"
          color={status === 'success' ? '$iconSuccess' : '$iconCritical'}
        />
      ) : null}
      <YStack mt="$5" alignItems="center">
        {label}
      </YStack>
      {description ? (
        <SizableText
          mt="$4"
          size="$bodyMd"
          color="$textSubdued"
          textAlign="center"
          testID={`${testID}-keep-unlocked`}
        >
          {description}
        </SizableText>
      ) : null}
    </YStack>
  );
}
