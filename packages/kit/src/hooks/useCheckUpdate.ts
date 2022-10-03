import { useMemo } from 'react';

import appUpdates from '../utils/updates/AppUpdates';

import { useAutoUpdate, useSettings } from './redux';

function useCheckUpdate() {
  const { latest, state } = useAutoUpdate();
  const { autoDownload } = useSettings().updateSetting ?? {};
  const showUpdateBadge = useMemo(() => {
    console.log('##$$%%^^^^^^ useCheckUpdate render');
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
    return showBadge;
  }, [latest, autoDownload, state]);

  return {
    showUpdateBadge,
  };
}

export { useCheckUpdate };
