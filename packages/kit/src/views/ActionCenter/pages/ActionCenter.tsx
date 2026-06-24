import { Page, useSafeAreaInsets } from '@onekeyhq/components';
import { MoreActionContentPage } from '@onekeyhq/kit/src/components/MoreActionButton';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ActionCenterTestIDs } from '../testIDs';

export default function ActionCenter() {
  const { top } = useSafeAreaInsets();
  // On iOS 26 MoreActionContentHeader emits a native <Page.Header />,
  // and the screens framework already positions Page.Body below the bar
  // (HeaderScreenOptions does NOT set headerTransparent for this modal
  // style page, so content does not extend under the bar). Don't add
  // any top inset here — that would double-shift the body and leave a
  // tall empty band under the bar. The mt: top branch is kept for iOS
  // <26 / Android / web where there's no native bar to reserve space.
  return (
    <Page>
      <Page.Body
        mt={platformEnv.isNativeIOS26Plus ? 0 : top}
        testID={ActionCenterTestIDs.pageBody}
      >
        <MoreActionContentPage />
      </Page.Body>
    </Page>
  );
}
