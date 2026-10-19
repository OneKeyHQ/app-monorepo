import type { PropsWithChildren } from 'react';
import { useState } from 'react';

import { useIntl } from 'react-intl';

import {
  rootNavigationRef,
  useOnRouterChange,
  useVisibilityChange,
} from '@onekeyhq/components';
import { useDeferredGuideBlocker } from '@onekeyhq/components/src/hooks/useDeferredGuideBlocker';
import { Spotlight } from '@onekeyhq/kit/src/components/Spotlight';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { usePortfolioSyncUiStateAtom } from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import { useDeviceStageAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/hardware';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ERootRoutes } from '@onekeyhq/shared/src/routes';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';
import { getCurrentVisibilityState } from '@onekeyhq/shared/src/utils/appVisibility';

import { WalletPortfolioIllustration } from './WalletPortfolioIllustration';

export function WalletPortfolioSpotlight({
  children,
  enabled,
  iconOnly,
}: PropsWithChildren<{ enabled: boolean; iconOnly?: boolean }>) {
  const intl = useIntl();
  const isFocused = useRouteIsFocused();
  const [isAppVisible, setIsAppVisible] = useState(getCurrentVisibilityState);
  useVisibilityChange(setIsAppVisible);
  const [stage] = useDeviceStageAtom();
  const [isRootCovered, setIsRootCovered] = useState(() => {
    const state = rootNavigationRef.current?.getRootState();
    return state?.routes[state.index ?? 0]?.name !== ERootRoutes.Main;
  });
  useOnRouterChange((state) => {
    setIsRootCovered(
      state?.routes[state.index ?? 0]?.name !== ERootRoutes.Main,
    );
  });
  const isStageShown = !!stage?.step && stage.step !== 'off';
  useDeferredGuideBlocker(isRootCovered || isStageShown);
  const [{ visible, disabled }] = usePortfolioSyncUiStateAtom();

  return (
    <Spotlight
      tourName={ESpotlightTour.portfolioMoreMenu}
      isVisible={enabled && isFocused && isAppVisible && visible && !disabled}
      delayMs={600}
      deferUntilIdle
      requireVisibleAnchor
      closeOnBackdropPress
      confirmText={intl.formatMessage({ id: ETranslations.global_got_it })}
      matchTriggerSize
      illustration={<WalletPortfolioIllustration />}
      illustrationGap={4}
      cardBorderRadius={24}
      highlightBorderRadius={24}
      confirmButtonBorderRadius="$full"
      confirmButtonPaddingHorizontal={14}
      cardPadding={24}
      cardPaddingBottom={20}
      cardGap={16}
      cardMaxWidth={280}
      alignCardToAnchorEnd={platformEnv.isNative}
      message={intl.formatMessage({
        id: ETranslations.portfolio_spotlight__desc,
      })}
      containerProps={
        iconOnly
          ? undefined
          : {
              flex: 1,
              flexBasis: 0,
              $gtSm: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
            }
      }
    >
      {children}
    </Spotlight>
  );
}
