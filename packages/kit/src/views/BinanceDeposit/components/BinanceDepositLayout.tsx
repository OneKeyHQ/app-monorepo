import type { PropsWithChildren, ReactNode } from 'react';

import { IconButton, SizableText, Stack, XStack } from '@onekeyhq/components';

export function DepositSection({
  title,
  headerRight,
  children,
}: PropsWithChildren<{ title: string; headerRight?: ReactNode }>) {
  return (
    <Stack gap="$3" pt="$4" borderTopWidth={1} borderColor="$borderSubdued">
      <XStack alignItems="center" justifyContent="space-between" gap="$3">
        <SizableText size="$headingMd">{title}</SizableText>
        {headerRight}
      </XStack>
      {children}
    </Stack>
  );
}

export function DepositField({
  label,
  value,
  testID,
  tone,
  onCopy,
  copyTestID,
}: {
  label: string;
  value: string;
  testID?: string;
  tone?: 'critical' | 'default';
  onCopy?: () => void;
  copyTestID?: string;
}) {
  return (
    <XStack gap="$3" alignItems="flex-start">
      <SizableText width={116} size="$bodySm" color="$textSubdued">
        {label}
      </SizableText>
      <SizableText
        flex={1}
        minWidth={0}
        size="$bodySm"
        color={tone === 'critical' ? '$textCritical' : '$text'}
        testID={testID}
        selectable
      >
        {value}
      </SizableText>
      {onCopy && copyTestID ? (
        <IconButton
          icon="Copy3Outline"
          size="small"
          variant="tertiary"
          onPress={onCopy}
          testID={copyTestID}
        />
      ) : null}
    </XStack>
  );
}

export function DepositHint({
  children,
  tone,
  testID,
}: PropsWithChildren<{ tone?: 'critical' | 'default'; testID?: string }>) {
  return (
    <SizableText
      size="$bodySm"
      color={tone === 'critical' ? '$textCritical' : '$textSubdued'}
      testID={testID}
    >
      {children}
    </SizableText>
  );
}
