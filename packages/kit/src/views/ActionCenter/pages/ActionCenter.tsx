import { useHeaderHeight } from '@react-navigation/elements';

import { Page, useSafeAreaInsets } from '@onekeyhq/components';
import { MoreActionContentPage } from '@onekeyhq/kit/src/components/MoreActionButton';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export default function ActionCenter() {
  const { top } = useSafeAreaInsets();
  // On iOS 26 the inner MoreActionContentHeader emits a native
  // <Page.Header /> whose Liquid Glass material is translucent. The
  // page body must reserve the bar's height as top inset, otherwise
  // the OneKey ID card slides up under the bar.
  const headerHeight = useHeaderHeight();
  return (
    <Page>
      <Page.Body
        mt={platformEnv.isNativeIOS26Plus ? 0 : top}
        pt={platformEnv.isNativeIOS26Plus ? headerHeight : 0}
      >
        <MoreActionContentPage />
      </Page.Body>
    </Page>
  );
}
