import { Page, useSafeAreaInsets } from '@onekeyhq/components';
import { MoreActionContentPage } from '@onekeyhq/kit/src/components/MoreActionButton';

import { ActionCenterTestIDs } from '../testIDs';

export default function ActionCenter() {
  const { top } = useSafeAreaInsets();
  return (
    <Page>
      <Page.Body mt={top} testID={ActionCenterTestIDs.pageBody}>
        <MoreActionContentPage />
      </Page.Body>
    </Page>
  );
}
