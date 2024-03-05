import { useMemo } from 'react';

import {
  Button,
  Image,
  LinearGradient,
  SizableText,
} from '@onekeyhq/components';
import { useLocaleVariant } from '@onekeyhq/kit/src/hooks/useLocaleVariant';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

export function Header() {
  const locale = useLocaleVariant();
  const url = useMemo(
    () => `https://lite.onekey.so/?language=${locale}`,
    [locale],
  );
  return (
    <LinearGradient
      colors={['rgba(222, 226, 229, 0.45)', 'rgba(222, 226, 229, 1)']}
      mx="$5"
      mt="$2"
      mb="$5"
      px="$5"
      pt="$9"
      pb="$6"
      borderRadius="$3"
    >
      <Image
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: 280,
          height: 158,
          resizeMode: 'cover',
        }}
        source={require('@onekeyhq/kit/assets/litecard/home_buy.png')}
      />
      <SizableText size="$headingXl" color="rgba(0, 0, 0, 0.95)">
        OneKey Lite
      </SizableText>
      <SizableText size="$bodyMd" color="rgba(0, 0, 0, 0.6)">
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
