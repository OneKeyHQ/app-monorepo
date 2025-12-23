import { Page, useSafeAreaInsets } from '@onekeyhq/components';
import { MoreActionContentPage } from '@onekeyhq/kit/src/components/MoreActionButton';

export default function MoreAction() {
  const { top, bottom } = useSafeAreaInsets();
  return (
    <Page>
      <Page.Body mt={top} pb={bottom}>
        <MoreActionContentPage />
      </Page.Body>
    </Page>
  );
}
