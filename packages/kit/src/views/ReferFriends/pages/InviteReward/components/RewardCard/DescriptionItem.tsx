import type { ReactNode } from 'react';

import { SizableText, XStack } from '@onekeyhq/components';

import { InfoIcon } from './InfoIcon';

export interface IDescriptionItemProps {
  label: string;
  value?: ReactNode;
  onInfoPress?: () => void;
  infoTooltip?: string | { title?: string; content: string };
}

export function DescriptionItem({
  label,
  value,
  onInfoPress,
  infoTooltip,
}: IDescriptionItemProps) {
  return (
    <XStack gap="$2" ai="center" jc="space-between">
      <XStack gap="$2" ai="center">
        <SizableText size="$bodyMd" color="$textSubdued">
          {label}
        </SizableText>
        {infoTooltip ? (
          <InfoIcon onPress={onInfoPress} tooltip={infoTooltip} />
        ) : null}
      </XStack>
      {value ? (
        <XStack ai="center" jc="flex-end" flex={1}>
          {typeof value === 'string' ? (
            <SizableText size="$bodyMdMedium" textAlign="right">
              {value}
            </SizableText>
          ) : (
            value
          )}
        </XStack>
      ) : null}
    </XStack>
  );
}
