import { useMemo } from 'react';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import appUpdates from '../utils/updates/AppUpdates';

import { useAutoUpdate, useSettings } from './redux';

function useCheckUpdate() {
  const { latest, state } = useAutoUpdate();
  const { autoDownload } = useSettings().updateSetting ?? {};
  const showUpdateBadge = useMemo(() => {
    let showBadge = false;
    if (!autoDownload && (state === 'available' || state === 'downloading')) {
      showBadge = true;
    }
    if (state === 'ready') {
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

  const showMobileUpdateBadge = useMemo(() => {
    if (state === 'available') {
      debugLogger.autoUpdate.debug(
        'useCheckUpdate render, showMobileBadge: true',
      );
      return true;
    }
    return false;
  }, [state]);

  return {
    showUpdateBadge,
    showMobileUpdateBadge,
  };
}

export { useCheckUpdate };
