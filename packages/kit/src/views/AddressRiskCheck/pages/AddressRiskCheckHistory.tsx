import { useCallback, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Empty, Page, ScrollView, YStack } from '@onekeyhq/components';
import HeaderIconButton from '@onekeyhq/components/src/layouts/Navigation/Header/HeaderIconButton';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IAddressRiskCheckRecentItem } from '@onekeyhq/shared/types/addressRiskCheck';

import { usePrimeFeatureAccess } from '../../Prime/hooks/usePrimeFeatureAccess';
import { RecentCheckItem } from '../components/RecentCheckItem';
import { useCheckAddressRisk } from '../hooks/useCheckAddressRisk';
import { useRecentChecks } from '../hooks/useRecentChecks';

// Page-level gate: the history needs a OneKey ID login (Prime or free trial),
// also when the route is opened directly or the user is logged out while on
// it. Logged-out users are sent to the dashboard.
export function useAddressRiskCheckHistoryAccess() {
  const navigation = useAppNavigation();
  const { isLoggedIn } = useOneKeyAuth();
  const { openPrimeDashboard } = usePrimeFeatureAccess();
  const isLoggedInRef = useRef(isLoggedIn);
  isLoggedInRef.current = isLoggedIn;
  const exitingRef = useRef(false);
  useEffect(() => {
    if (isLoggedIn || exitingRef.current) {
      return;
    }
    exitingRef.current = true;
    void (async () => {
      // The local projection may lag on a cold start, and the login may come
      // back while this waits.
      if (
        (await backgroundApiProxy.servicePrime.isLoggedIn()) ||
        isLoggedInRef.current
      ) {
        exitingRef.current = false;
        return;
      }
      navigation.pop();
      await timerUtils.wait(300);
      if (await backgroundApiProxy.servicePrime.isLoggedIn()) {
        return;
      }
      openPrimeDashboard({
        featureId: EPrimeFeatures.AddressRiskCheck,
        afterPageExit: true,
      });
    })();
    // Runs on mount and whenever the login state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);
  return Boolean(isLoggedIn);
}

function AddressRiskCheckHistory() {
  const intl = useIntl();
  const canViewHistory = useAddressRiskCheckHistoryAccess();
  const { items, networkNameMap, deleteOne, clearAll } = useRecentChecks();
  const { checkRisk } = useCheckAddressRisk();

  const handlePress = useCallback(
    (item: IAddressRiskCheckRecentItem) => {
      checkRisk({
        networkId: item.networkId,
        address: item.address,
        entryPoint: 'historyList',
      });
    },
    [checkRisk],
  );

  const handleClearAll = useCallback(() => {
    Dialog.show({
      title: intl.formatMessage({
        id: ETranslations.address_risk_check_clear_history__title,
      }),
      description: intl.formatMessage({
        id: ETranslations.address_risk_check_clear_history__desc,
      }),
      tone: 'destructive',
      icon: 'DeleteOutline',
      onConfirm: async () => {
        await clearAll();
      },
    });
  }, [clearAll, intl]);

  const headerRight = useCallback(
    () =>
      canViewHistory && items.length ? (
        <HeaderIconButton icon="BroomOutline" onPress={handleClearAll} />
      ) : null,
    [canViewHistory, items.length, handleClearAll],
  );

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.address_risk_check_history__title,
        })}
        headerRight={headerRight}
      />
      <Page.Body>
        {canViewHistory && items.length ? (
          <ScrollView>
            <YStack py="$2">
              {items.map((item) => (
                <RecentCheckItem
                  key={`${item.networkId}_${item.address}`}
                  item={item}
                  networkName={networkNameMap[item.networkId]}
                  onPress={handlePress}
                  onDelete={deleteOne}
                />
              ))}
            </YStack>
          </ScrollView>
        ) : null}
        {canViewHistory && !items.length ? (
          <Empty
            icon="ClockTimeHistoryOutline"
            title={intl.formatMessage({
              id: ETranslations.address_risk_check_history_empty__title,
            })}
            description={intl.formatMessage({
              id: ETranslations.address_risk_check_history_empty__desc,
            })}
          />
        ) : null}
      </Page.Body>
    </Page>
  );
}

export default AddressRiskCheckHistory;
