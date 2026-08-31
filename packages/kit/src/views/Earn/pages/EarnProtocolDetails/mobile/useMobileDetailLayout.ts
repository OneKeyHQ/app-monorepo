import { useMedia } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// The revamped detail layout ships to phones only. Desktop, web, mobile web and
// wide native (iPad, landscape) keep the existing single-column page untouched.
export function useMobileDetailLayout() {
  const { gtMd } = useMedia();
  return platformEnv.isNative && !gtMd;
}
