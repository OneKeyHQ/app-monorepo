import { Image, Stack, XStack } from '@onekeyhq/components';
import type { IMarketStockListVariant } from '@onekeyhq/shared/types/marketV2';

// The design overlaps the variant logos by 4px and rings each in the page
// background, so the stack reads as one group rather than separate icons.
const VARIANT_LOGO_SIZE = 16;
const VARIANT_LOGO_OVERLAP = -4;

// Past this the row would run out of subtitle width; the count carries the rest.
const MAX_VISIBLE_VARIANT_LOGOS = 4;

/**
 * The overlapping issuer logos shown beside a stock's variant count. Earlier
 * logos sit on top, so the group reads left to right.
 */
export function MarketVariantLogoGroup({
  variants,
}: {
  variants: IMarketStockListVariant[];
}) {
  const visible = variants.slice(0, MAX_VISIBLE_VARIANT_LOGOS);
  if (visible.length === 0) {
    return null;
  }

  return (
    <XStack alignItems="center">
      {visible.map((variant, index) => (
        <Stack
          key={variant.tokenId}
          width={VARIANT_LOGO_SIZE}
          height={VARIANT_LOGO_SIZE}
          borderRadius="$full"
          borderWidth={1}
          borderColor="$bgApp"
          bg="$bgStrong"
          overflow="hidden"
          alignItems="center"
          justifyContent="center"
          // The last logo keeps its full width so the group ends flush.
          mr={index === visible.length - 1 ? 0 : VARIANT_LOGO_OVERLAP}
          zIndex={visible.length - index}
        >
          <Image
            width="100%"
            height="100%"
            borderRadius="$full"
            source={{ uri: variant.logoUrl }}
          />
        </Stack>
      ))}
    </XStack>
  );
}
