import { useCallback, useMemo } from 'react';

import { rootNavigationRef, useMedia } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalDeviceManagementRoutes,
  EModalRoutes,
  EOnboardingPages,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../../hooks/useAppNavigation';

export const useIsGtMdNonNative = () => {
  const { gtMd } = useMedia();
  return useMemo(() => gtMd && !platformEnv.isNative, [gtMd]);
};
