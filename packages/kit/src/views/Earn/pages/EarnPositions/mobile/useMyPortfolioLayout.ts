import { useMedia } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// Web review switch (OK-61377): product walks the phone layout through in a
// browser narrowed under 768px, so web at phone width renders it too. Only
// web and only at phone width: desktop, the extension and wide web keep the
// existing page. Flip to false if product wants phone-width web back on the
// old page after the review.
const PHONE_LAYOUT_ON_WEB = true;

// The revamped positions page ("My portfolio", OK-61377) ships to phones.
// Wide layouts (desktop, iPad, landscape, wide web) keep the existing
// PortfolioTabContent page untouched — the same gate the detail page uses.
export function useMyPortfolioLayout() {
  const { gtMd } = useMedia();
  if (gtMd) {
    return false;
  }
  return platformEnv.isNative || (platformEnv.isWeb && PHONE_LAYOUT_ON_WEB);
}
