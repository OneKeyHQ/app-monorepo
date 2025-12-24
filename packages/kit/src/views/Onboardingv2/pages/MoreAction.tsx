import { Page, useSafeAreaInsets } from '@onekeyhq/components';
import { MoreActionContentPage } from '@onekeyhq/kit/src/components/MoreActionButton';

export default function MoreAction() {
  const { top } = useSafeAreaInsets();
  return (
    <Page>
      <Page.Body mt={top}>
        <MoreActionContentPage />
      </Page.Body>
    </Page>
  );
}
