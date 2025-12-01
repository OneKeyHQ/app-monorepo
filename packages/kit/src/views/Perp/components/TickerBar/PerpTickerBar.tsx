import { memo } from 'react';

import { useIsGtMd } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { PerpTickerBarDesktop } from './PerpTickerBarDesktop';
import { PerpTickerBarMobile } from './PerpTickerBarMobile';

function PerpTickerBar() {
  const gtMd = useIsGtMd();

  if (!gtMd || platformEnv.isNative) {
    return <PerpTickerBarMobile />;
  }
  return <PerpTickerBarDesktop />;
}

const PerpTickerBarMemo = memo(PerpTickerBar);
export { PerpTickerBarMemo as PerpTickerBar };
