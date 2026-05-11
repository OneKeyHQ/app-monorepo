import { useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import { isNativeTablet } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { useIsSpanningInDualScreen } from '@onekeyhq/shared/src/modules/DualScreenInfo';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import { showSplitViewPromptDialog } from './showSplitViewPromptDialog';

// One-shot first-launch prompt for tablets / Android dual-screen devices.
// Fires after the device first enters a split-capable state — for iPad
// that's any first render, for Android dual-screen it's when `isSpanning`
// becomes true. Persistence uses ESpotlightTour.splitViewFirstPrompt so the
// prompt only appears once per install.
export function SplitViewPrompt() {
  const intl = useIntl();
  const isSpanning = useIsSpanningInDualScreen();
  const tablet = isNativeTablet();
  const [{ enableSplitView }] = useSettingsPersistAtom();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current || !tablet) return;

    const splitCapable = platformEnv.isNativeIOSPad || isSpanning;
    if (!splitCapable) return;

    firedRef.current = true;

    // Intentionally no cleanup: during an unfold animation `isSpanning` can
    // briefly toggle false→true→false→true as Dimensions re-emit. A cleanup
    // that clears the timer would lose the prompt because firedRef is
    // already true on the next run, leaving the dialog forever unscheduled.
    setTimeout(() => {
      void (async () => {
        const visited = await backgroundApiProxy.serviceSpotlight.isVisited(
          ESpotlightTour.splitViewFirstPrompt,
        );
        if (visited) return;
        showSplitViewPromptDialog({
          currentEnabled: enableSplitView !== false,
          intl,
        });
      })();
    }, 800);
  }, [tablet, isSpanning, enableSplitView, intl]);

  return null;
}
