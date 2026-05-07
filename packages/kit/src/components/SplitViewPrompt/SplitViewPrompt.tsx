import { useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import { isNativeTablet } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  isDualScreenDevice,
  useIsSpanningInDualScreen,
} from '@onekeyhq/shared/src/modules/DualScreenInfo';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import { showSplitViewPromptDialog } from './showSplitViewPromptDialog';

// Debug-only tag so logs can be filtered with: `[SplitViewPrompt]`.
const LOG = '[SplitViewPrompt]';

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

  // eslint-disable-next-line no-console
  console.log(LOG, 'render', {
    tablet,
    isSpanning,
    isNativeIOSPad: platformEnv.isNativeIOSPad,
    isDualScreen: isDualScreenDevice(),
    enableSplitView,
    fired: firedRef.current,
  });

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log(LOG, 'effect run', {
      tablet,
      isSpanning,
      isNativeIOSPad: platformEnv.isNativeIOSPad,
      fired: firedRef.current,
    });

    if (firedRef.current) {
      // eslint-disable-next-line no-console
      console.log(LOG, 'bail: already fired');
      return;
    }
    if (!tablet) {
      // eslint-disable-next-line no-console
      console.log(LOG, 'bail: not tablet (isNativeTablet=false)');
      return;
    }

    const splitCapable = platformEnv.isNativeIOSPad || isSpanning;
    if (!splitCapable) {
      // eslint-disable-next-line no-console
      console.log(LOG, 'bail: not split-capable yet (waiting for spanning)');
      return;
    }

    firedRef.current = true;
    // eslint-disable-next-line no-console
    console.log(LOG, 'scheduled 800ms timer');

    // Intentionally no cleanup: during an unfold animation `isSpanning` can
    // briefly toggle false→true→false→true as Dimensions re-emit. A cleanup
    // that clears the timer would lose the prompt because firedRef is
    // already true on the next run, leaving the dialog forever unscheduled.
    setTimeout(() => {
      void (async () => {
        // eslint-disable-next-line no-console
        console.log(LOG, 'timer fired, querying spotlight');
        const visited = await backgroundApiProxy.serviceSpotlight.isVisited(
          ESpotlightTour.splitViewFirstPrompt,
        );
        // eslint-disable-next-line no-console
        console.log(LOG, 'spotlight visited =', visited);
        if (visited) {
          // eslint-disable-next-line no-console
          console.log(LOG, 'bail: tour already visited');
          return;
        }
        // eslint-disable-next-line no-console
        console.log(LOG, 'showing dialog');
        showSplitViewPromptDialog({
          currentEnabled: enableSplitView !== false,
          intl,
        });
      })();
    }, 800);
  }, [tablet, isSpanning, enableSplitView, intl]);

  return null;
}
