import type { FC } from 'react';
import { useEffect } from 'react';

import { revokeUrl } from '@onekeyhq/engine/src/managers/revoke';

import { navigationShortcuts } from '../../routes/navigationShortcuts';
import { openDapp } from '../../utils/openUrl';

const RevokePage: FC = () => {
  useEffect(() => {
    openDapp(revokeUrl);
    navigationShortcuts.navigateToDiscover();
  }, []);
  return null;
};

export default RevokePage;
