import { Page } from '@onekeyhq/components';

import { PerpMobileLayoutSkeleton } from '../../../../../Perp/layouts/PerpMobileLayoutSkeleton';

export default function PerpSkeletonPreview() {
  return (
    <Page>
      <Page.Header title="Perp Skeleton Preview" />
      <Page.Body>
        <PerpMobileLayoutSkeleton />
      </Page.Body>
    </Page>
  );
}
