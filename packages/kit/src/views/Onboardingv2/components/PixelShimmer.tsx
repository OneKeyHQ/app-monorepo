import type { IPixelShimmerProps } from './PixelShimmer.types';

// Native/default build: the pixel-shimmer hover effect is web + desktop only
// (it needs a 2D canvas and pointer hover), so on native it renders nothing and
// pulls in zero DOM APIs. The real implementation lives in PixelShimmer.web.tsx.
export default function PixelShimmer(_props: IPixelShimmerProps) {
  return null;
}
