import { useCallback } from 'react';

import { Icon, SizableText, Stack } from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components/src/primitives';

import type { ColorTokens } from 'tamagui';

type IToneType = 'destructive' | 'warning' | 'success';

const getColors = (
  tone?: IToneType,
): {
  iconWrapperBg: ColorTokens;
  iconColor: ColorTokens;
} => {
  switch (tone) {
    case 'destructive': {
      return {
        iconWrapperBg: '$bgCritical',
        iconColor: '$iconCritical',
      };
    }
    case 'warning': {
      return {
        iconWrapperBg: '$bgCaution',
        iconColor: '$iconCaution',
      };
    }
    case 'success': {
      return {
        iconWrapperBg: '$bgSuccess',
        iconColor: '$iconSuccess',
      };
    }
    default: {
      return {
        iconWrapperBg: '$bgStrong',
        iconColor: '$icon',
      };
    }
  }
};

export function FirmwareUpdateBaseMessageView({
  icon,
  title,
  tone,
  message,
}: {
  icon?: IKeyOfIcons;
  title?: string;
  tone?: IToneType;
  message?: string;
}) {
  const renderIcon = useCallback(
    () =>
      icon?.endsWith('Solid') ? (
        <Icon name={icon} size="$14" color={getColors(tone).iconColor} />
      ) : (
        <Stack
          alignSelf="flex-start"
          p="$3"
          borderRadius="$full"
          bg={getColors(tone).iconWrapperBg}
        >
          <Icon name={icon} size="$7" color={getColors(tone).iconColor} />
        </Stack>
      ),
    [icon, tone],
  );
  return (
    <Stack py="$6">
      {icon ? renderIcon() : null}
      {title ? (
        <SizableText my="$4" size="$heading2xl">
          {title}
        </SizableText>
      ) : null}
      {message ? (
        <SizableText color="$textSubdued">{message}</SizableText>
      ) : null}
    </Stack>
  );
}
