import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  SizableText,
  Stack,
  useIsIpadLandscape,
  useMedia,
} from '@onekeyhq/components';
import {
  HeaderButtonGroup,
  HeaderIconButton,
} from '@onekeyhq/components/src/layouts/Navigation/Header';
import { NetworkSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector/NetworkSelectorTrigger';
import {
  useDevSettingsPersistAtom,
  useNotificationsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalNotificationsRoutes } from '@onekeyhq/shared/src/routes/notifications';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import useAppNavigation from '../../hooks/useAppNavigation';
import { useLoginOneKeyId } from '../../hooks/useLoginOneKeyId';
import { UrlAccountNavHeader } from '../../views/Home/pages/urlAccount/UrlAccountNavHeader';
import { PrimeHeaderIconButtonLazy } from '../../views/Prime/components/PrimeHeaderIconButton';

import { MoreActionButton } from './MoreActionButton';

function MoreAction() {
  return <MoreActionButton key="more-action" />;
}

function SelectorTrigger() {
  return (
    <NetworkSelectorTriggerHome
      num={0}
      size="small"
      recordNetworkHistoryEnabled
    />
  );
}

export function HeaderRight({
  tabRoute,
}: {
  sceneName: EAccountSelectorSceneName;
  tabRoute: ETabRoutes;
}) {
  const items = useMemo(() => {
    switch (tabRoute) {
      case ETabRoutes.Home:
        return (
          <>
            <SelectorTrigger />
            <MoreAction />
          </>
        );
      case ETabRoutes.Swap:
      case ETabRoutes.Market:
        return <MoreAction />;
      case ETabRoutes.Discovery:
      case ETabRoutes.Earn:
        return (
          <>
            <SelectorTrigger />
            <MoreAction />
          </>
        );

      default:
        break;
    }
  }, [tabRoute]);
  return (
    <HeaderButtonGroup
      testID="Wallet-Page-Header-Right"
      className="app-region-no-drag"
    >
      {items}
    </HeaderButtonGroup>
  );
}
