import { useMemo } from 'react';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import {
  selectAutoUpdateLatest,
  selectAutoUpdateState,
  selectUpdateSetting,
} from '../store/selectors';
import appUpdates from '../utils/updates/AppUpdates';

import { useAppSelector } from './redux';

function useCheckUpdate() {
  const latest = useAppSelector(selectAutoUpdateLatest);
  const state = useAppSelector(selectAutoUpdateState);

  const { autoDownload } = useAppSelector(selectUpdateSetting) ?? {};
  const showUpdateBadge = useMemo(() => {
    let showBadge = false;
    if (!autoDownload && state === 'available') {
      showBadge = true;
    }
    if (state === 'ready') {
      showBadge = true;
    }
    if (
      latest &&
      // Narrowing type to DesktopVersion
      'version' in latest &&
      appUpdates.skipVersionCheck(latest.version)
    ) {
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
