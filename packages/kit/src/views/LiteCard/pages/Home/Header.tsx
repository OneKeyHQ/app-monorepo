import { useMemo } from 'react';

import {
  Button,
  Image,
  LinearGradient,
  SizableText,
  XStack,
} from '@onekeyhq/components';
import { useLocaleVariant } from '@onekeyhq/kit/src/hooks/useLocaleVariant';
import { LITE_CARD_URL } from '@onekeyhq/shared/src/config/appConfig';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

export function Header() {
  const locale = useLocaleVariant();
  const url = useMemo(() => `${LITE_CARD_URL}?language=${locale}`, [locale]);
  return (
    <LinearGradient
      colors={['rgba(222, 226, 229, 0.45)', 'rgba(222, 226, 229, 1)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      mx="$5"
      mt="$2"
      mb="$5"
      px="$5"
      pt="$9"
      pb="$6"
      borderRadius="$3"
    >
      <XStack fullscreen borderRadius="$3" overflow="hidden">
        <Image
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: 240,
            height: '100%',
            resizeMode: 'cover',
          }}
          source={require('@onekeyhq/kit/assets/litecard/home_buy.png')}
        />
      </XStack>
      <SizableText size="$headingXl" color="rgba(0, 0, 0, 0.95)">
        OneKey Lite
      </SizableText>
      <SizableText size="$bodyMd" color="rgba(0, 0, 0, 0.6)" pr={130}>
        Restore your wallet without typing one word.
      </SizableText>
      <Button
        bg="rgba(0, 0, 0, 0.95)"
        mt="$6"
        alignSelf="flex-start"
        size="small"
        color="white"
        iconAfter="OpenOutline"
        iconColor="white"
        focusStyle={{ bg: 'rgba(0, 0, 0, 0.75)' }}
        hoverStyle={{ bg: 'rgba(0, 0, 0, 0.75)' }}
        onPress={() => openUrlExternal(url)}
      >
        Buy One
      </Button>
    </LinearGradient>
  );
}
