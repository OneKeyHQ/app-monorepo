import { useEffect, useRef } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';

import { SubsidyRecordsPaged } from './SubsidyRecords';
import { useSubsidyIdentity } from './useSubsidyRecords';

// Full record list opened from "View more" on the mobile overview. The
// desktop layout shows the same list in its side panel instead.
export default function SubsidyHistory() {
  const identity = useSubsidyIdentity();
  const navigation = useAppNavigation();

  // Records need a OneKey ID. When the session ends while this page is open
  // there is nothing to list and no request to wait for, so the page returns
  // to the subsidy center, which shows the sign-in state.
  const leftRef = useRef(false);
  useEffect(() => {
    if (!identity && !leftRef.current) {
      leftRef.current = true;
      navigation.pop();
    }
  }, [identity, navigation]);

  return <SubsidyRecordsPaged identity={identity} />;
}
