import { SubsidyRecordsPaged } from './SubsidyRecords';
import { useSubsidyIdentity } from './useSubsidyRecords';

// Full record list opened from "View more" on the mobile overview. The
// desktop layout shows the same list in its side panel instead.
export default function SubsidyHistory() {
  return <SubsidyRecordsPaged identity={useSubsidyIdentity()} />;
}
