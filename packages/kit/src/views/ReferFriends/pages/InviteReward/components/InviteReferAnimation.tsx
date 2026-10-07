import { useWindowDimensions } from 'react-native';

import { LottieView, Stack } from '@onekeyhq/components';
import { useReferLottieSource } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useReferLottieSource';

import { getInviteIllustrationSize } from './getInviteIllustrationSize';

export function InviteReferAnimation() {
  const { height: windowHeight } = useWindowDimensions();
  const { width, height } = getInviteIllustrationSize(windowHeight);
  const source = useReferLottieSource();

  return (
    <Stack w={width} h={height} maxWidth="100%" alignSelf="center">
      {source ? (
        <LottieView
          source={source}
          width={width}
          height={height}
          autoPlay
          loop={false}
          resizeMode="contain"
        />
      ) : null}
    </Stack>
  );
}
