import { memo, useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { Platform, StyleSheet } from 'react-native';

import {
  Alert,
  Button,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsNetworkStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

function PerpNetworkAlertComponent() {
  const intl = useIntl();
  const [networkStatus] = usePerpsNetworkStatusAtom();
  const actions = useHyperliquidActions();
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);
  const handleRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      await actions.current.refreshAllPerpsData();
    } catch (error) {
      console.error(error);
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [actions]);

  if (networkStatus?.connected !== false) {
    return null;
  }

  const title = intl.formatMessage({
    id: Platform.select({
      web: ETranslations.perps_offline_desktop__msg,
      default: ETranslations.perps_offline_moblie,
    }),
  });

  return (
    <YStack overflow="visible" zIndex={10}>
      <Alert
        type="default"
        fullBleed
        icon="ChartColumnarSignal2Outline"
        title={platformEnv.isDesktop ? undefined : title}
        renderTitle={
          platformEnv.isDesktop
            ? (props) => (
                <XStack alignItems="center" gap="$3">
                  <SizableText {...props} flexShrink={1}>
                    {title}
                  </SizableText>
                  <Button
                    size="small"
                    variant="secondary"
                    flexShrink={0}
                    testID="perp-network-alert-refresh"
                    onPress={handleRefresh}
                    loading={refreshing}
                    disabled={refreshing}
                  >
                    {intl.formatMessage({ id: ETranslations.global_refresh })}
                  </Button>
                </XStack>
              )
            : undefined
        }
        action={
          platformEnv.isDesktop
            ? undefined
            : {
                primary: intl.formatMessage({
                  id: ETranslations.global_refresh,
                }),
                primaryVariant: 'secondary',
                primaryTestID: 'perp-network-alert-refresh',
                onPrimaryPress: handleRefresh,
                isPrimaryLoading: refreshing,
                isPrimaryDisabled: refreshing,
              }
        }
        closable={false}
        px="$4"
        {...Platform.select({
          web: {
            borderTopWidth: 0,
            borderBottomWidth: platformEnv.isWeb ? StyleSheet.hairlineWidth : 0,
          },
        })}
      />
    </YStack>
  );
}

export const PerpNetworkAlert = memo(PerpNetworkAlertComponent);
