import { Page } from '@onekeyhq/components';

import { SubsidyRecordsPanel, subsidyRecordsCopy } from './SubsidyRecords';
import { useSubsidyHistory, useSubsidyIdentity } from './useSubsidyRecords';

// Full record list opened from "View more" on the mobile overview. The
// desktop layout shows the same list in its side panel instead.
export default function SubsidyHistory() {
  const query = useSubsidyHistory(useSubsidyIdentity());
  return (
    <Page>
      <Page.Header title={subsidyRecordsCopy.title} />
      <Page.Body px="$5" pt="$2">
        <SubsidyRecordsPanel query={query} />
      </Page.Body>
    </Page>
  );
}
