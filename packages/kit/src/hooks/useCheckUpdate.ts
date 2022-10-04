import { useMemo } from 'react';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import appUpdates from '../utils/updates/AppUpdates';

import { useAutoUpdate, useSettings } from './redux';

function useCheckUpdate() {
  const { latest, state } = useAutoUpdate();
  const { autoDownload } = useSettings().updateSetting ?? {};
  const showUpdateBadge = useMemo(() => {
    let showBadge = false;
    if (!autoDownload && state === 'available') {
      showBadge = true;
    }
    if (autoDownload && state === 'ready') {
      showBadge = true;
    }
    // @ts-expect-error
    if ((latest ?? {}).version && appUpdates.skipVersionCheck(latest.version)) {
      showBadge = false;
    }

    debugLogger.autoUpdate.debug(
      'useCheckUpdate render, showBadge: ',
      showBadge,
    );
    return showBadge;
  }, [latest, autoDownload, state]);

  return {
    showUpdateBadge,
  };
}

export { useCheckUpdate };
