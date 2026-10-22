import { Suspense, lazy, useEffect, useState } from 'react';

import {
  readWebReferralCode,
  subscribeWebReferralCode,
} from '../../utils/webReferralCode';

const LazyWebReferralBindContainer = lazy(() =>
  import('./WebReferralBindContainer').then((module) => ({
    default: module.WebReferralBindContainer,
  })),
);

export function WebReferralBindGate() {
  const [shouldMount, setShouldMount] = useState(() =>
    Boolean(readWebReferralCode()),
  );

  useEffect(() => {
    const check = () => {
      if (readWebReferralCode()) {
        setShouldMount(true);
      }
    };
    const unsubscribe = subscribeWebReferralCode(check);
    check();
    return unsubscribe;
  }, []);

  if (!shouldMount) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <LazyWebReferralBindContainer />
    </Suspense>
  );
}
