import { memo } from 'react';

import { Image, YStack, useMedia } from '@onekeyhq/components';

// The card's picture: stacks of tokens in green metal, each taller than the
// one before, and a token coming down on the tallest. One rendered scene,
// kept as two cuts: all of it for a wide card, and the two tallest stacks
// for a phone's, where the steps take the card's width. Both fade into the
// card's own color on the side its words are on.
const WIDE_ASPECT = 1120 / 400;
// Beside the steps on a phone's card, above its button
const PHONE_ART = { width: 119, height: 190, top: 18, right: -4 } as const;

function EarnGuideArtView({
  radius,
}: {
  /** The card's corner, for the hairline around it */
  radius: number;
}) {
  const isWide = useMedia().gtMd;
  return (
    <YStack
      position="absolute"
      top={0}
      right={0}
      bottom={0}
      left={0}
      pointerEvents="none"
    >
      {isWide ? (
        // As tall as the card, whatever its copy makes of it, at the
        // picture's own proportions
        <YStack
          position="absolute"
          top={0}
          right={0}
          bottom={0}
          aspectRatio={WIDE_ASPECT}
        >
          <Image
            w="100%"
            h="100%"
            source={require('@onekeyhq/kit/assets/earn_guide_stacks.webp')}
            resizeMode="cover"
          />
        </YStack>
      ) : (
        <Image
          position="absolute"
          top={PHONE_ART.top}
          right={PHONE_ART.right}
          w={PHONE_ART.width}
          h={PHONE_ART.height}
          source={require('@onekeyhq/kit/assets/earn_guide_stacks_phone.webp')}
          resizeMode="cover"
        />
      )}
      {/* An edge for the card on the dark page */}
      <YStack
        position="absolute"
        top={0}
        right={0}
        bottom={0}
        left={0}
        borderRadius={radius}
        borderCurve="continuous"
        borderWidth={1}
        borderColor="rgba(255, 255, 255, 0.07)"
      />
    </YStack>
  );
}

export const EarnGuideArt = memo(EarnGuideArtView);
