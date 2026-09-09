import { useCallback, useRef, useState } from 'react';

import { useHeaderHeight } from '@react-navigation/elements';
import { useIntl } from 'react-intl';

import { HeaderIconButton, Page } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';

import { EarnProviderMirror } from '../../Earn/EarnProviderMirror';
import { useStakingPendingTxsByInfo } from '../../Earn/hooks/useStakingPendingTxs';
import { isBorrowTag } from '../../Staking/utils/utils';
import { BorrowTestIDs } from '../testIDs';

import { BorrowHome } from './BorrowHome';

const BORROW_PENDING_REFRESH_DELAY = timerUtils.getTimeDurationMs({
  seconds: 3,
});

function BorrowHomePageContent() {
  const intl = useIntl();
  const headerHeight = useHeaderHeight();
  const bodyPaddingTop = platformEnv.isNativeIOS26Plus ? headerHeight : 0;
  const [borrowNetworkIds, setBorrowNetworkIds] = useState<string[]>([]);
  const [showBorrowHistoryAction, setShowBorrowHistoryAction] = useState(false);
  const borrowRefreshHandlerRef = useRef<(() => Promise<void>) | null>(null);
  const borrowHistoryHandlerRef = useRef<(() => void) | null>(null);

  const handleRegisterBorrowRefresh = useCallback(
    (handler: (() => Promise<void>) | null) => {
      borrowRefreshHandlerRef.current = handler;
    },
    [],
  );

  const handleBorrowNetworksChange = useCallback((nextNetworkIds: string[]) => {
    setBorrowNetworkIds((prev) => {
      if (
        prev.length === nextNetworkIds.length &&
        prev.every((id, index) => id === nextNetworkIds[index])
      ) {
        return prev;
      }
      return nextNetworkIds;
    });
  }, []);

  const handleBorrowPendingRefresh = useCallback(() => {
    void borrowRefreshHandlerRef.current?.();
  }, []);

  const handleBorrowHistoryActionChange = useCallback(
    (handler: (() => void) | null, visible: boolean) => {
      borrowHistoryHandlerRef.current = handler;
      setShowBorrowHistoryAction((previous) =>
        previous === visible ? previous : visible,
      );
    },
    [],
  );

  const handleOpenBorrowHistory = useCallback(() => {
    borrowHistoryHandlerRef.current?.();
  }, []);

  const renderHeaderRight = useCallback(
    () => (
      <HeaderIconButton
        testID={BorrowTestIDs.overviewHistoryBtn}
        icon="ClockTimeHistoryOutline"
        size="small"
        title={intl.formatMessage({ id: ETranslations.global_history })}
        onPress={handleOpenBorrowHistory}
      />
    ),
    [handleOpenBorrowHistory, intl],
  );

  const borrowPendingTagMatcher = useCallback(
    (tag: string) => isBorrowTag(tag) || tag === EEarnLabels.Borrow,
    [],
  );

  const { filteredTxs: borrowPendingTxs = [] } = useStakingPendingTxsByInfo({
    networkIds: borrowNetworkIds,
    tagMatcher: borrowPendingTagMatcher,
    onRefresh: handleBorrowPendingRefresh,
    onRefreshDelayMs: BORROW_PENDING_REFRESH_DELAY,
  });

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_borrow })}
        headerRight={showBorrowHistoryAction ? renderHeaderRight : undefined}
      />
      <Page.Body pt={bodyPaddingTop}>
        <BorrowHome
          isActive
          pendingTxs={borrowPendingTxs}
          onRegisterBorrowRefresh={handleRegisterBorrowRefresh}
          onBorrowNetworksChange={handleBorrowNetworksChange}
          onBorrowHistoryActionChange={handleBorrowHistoryActionChange}
        />
      </Page.Body>
    </Page>
  );
}

export default function BorrowHomePage() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <BorrowHomePageContent />
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
