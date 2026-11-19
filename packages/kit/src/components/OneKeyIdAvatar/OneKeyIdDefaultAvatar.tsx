import { memo, useId, useMemo } from 'react';

import { SvgXml } from 'react-native-svg';

import { getTokenValue } from '@onekeyhq/components';
import type { IImageProps } from '@onekeyhq/components';

import { buildOneKeyIdDefaultAvatarXml } from './defaultAvatarXml';

import type { Token } from 'tamagui';

// At header and drawer sizes the fine details only add noise.
const SMALL_AVATAR_MAX_SIZE = 48;

function BasicOneKeyIdDefaultAvatar({
  seed,
  size,
}: {
  seed: string;
  size: IImageProps['width'];
}) {
  const px =
    typeof size === 'number' ? size : getTokenValue(size as Token, 'size');
  const reactId = useId();
  const xml = useMemo(
    () =>
      buildOneKeyIdDefaultAvatarXml(seed, {
        small: px <= SMALL_AVATAR_MAX_SIZE,
        // Web renders real DOM ids, which must not repeat across avatars.
        idPrefix: `avatar${reactId.replace(/[^a-zA-Z0-9]/g, '')}`,
      }),
    [seed, px, reactId],
  );
  return <SvgXml xml={xml} width={px} height={px} />;
}

export const OneKeyIdDefaultAvatar = memo(BasicOneKeyIdDefaultAvatar);
