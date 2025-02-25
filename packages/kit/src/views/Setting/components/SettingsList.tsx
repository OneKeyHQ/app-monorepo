import type { ReactNode } from 'react';

import {
  Divider,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';

export interface ISettingsListRowProps {
  title: string;
  renderRight?: () => ReactNode;
  subDescription?: string;
}

export function SettingsListRow({
  title,
  renderRight,
  subDescription,
}: ISettingsListRowProps) {
  return (
    <YStack p="$4">
      <XStack justifyContent="space-between" alignItems="center">
        <SizableText size="$bodyLg">{title}</SizableText>
        {renderRight ? renderRight() : null}
      </XStack>
      {subDescription ? (
        <SizableText mt="$1.5" size="$bodyMd" color="$textSubdued">
          {subDescription}
        </SizableText>
      ) : null}
    </YStack>
  );
}

export function SettingsListItemSeparator() {
  return <Divider />;
}
