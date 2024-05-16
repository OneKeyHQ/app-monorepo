import { useCallback, useMemo } from 'react';

import { Icon, SizableText, Stack } from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components/src/primitives';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

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
  linkList = [],
}: {
  icon?: IKeyOfIcons;
  title?: string;
  tone?: IToneType;
  message?: string;
  linkList?: { start: number; end: number; url: string }[];
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
  const textList = useMemo(() => {
    if (!message) {
      return undefined;
    }
    let index = 0;
    const subTextList = [];
    linkList
      .sort((a, b) => a.start - b.start)
      .forEach((link) => {
        subTextList.push(message.slice(index, link.start));
        index = link.start;
        subTextList.push(
          <SizableText
            color="$textInfo"
            onPress={() => openUrlExternal(link.url)}
          >
            {message.slice(index, link.end)}
          </SizableText>,
        );
        index = link.end;
      });
    subTextList.push(message.slice(index));
    return subTextList;
  }, [message, linkList]);
  return (
    <Stack py="$6">
      {icon ? renderIcon() : null}
      {title ? (
        <SizableText my="$4" size="$heading2xl">
          {title}
        </SizableText>
      ) : null}
      {textList ? (
        <SizableText size="$bodyLg" color="$textSubdued">
          {textList}
        </SizableText>
      ) : null}
    </Stack>
  );
}
