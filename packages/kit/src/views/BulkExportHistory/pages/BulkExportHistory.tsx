import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  ESwitchSize,
  Page,
  SegmentControl,
  SizableText,
  Spinner,
  Stack,
  Switch,
  XStack,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { AccountSelectorTriggerBulkExportHistory } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorTrigger/AccountSelectorTriggerBulkExportHistory';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalBulkExportHistoryRoutes,
  type IModalBulkExportHistoryParamList,
} from '@onekeyhq/shared/src/routes/bulkExportHistory';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import BulkExportHistoryNetworkTrigger from '../components/BulkExportHistoryNetworkTrigger';
import { useBulkExportHistorySupportedNetworks } from '../hooks/useBulkExportHistorySupportedNetworks';

enum EDateRange {
  LastMonth = 'lastMonth',
  Last3Months = 'last3Months',
  Custom = 'custom',
}

const DATE_RANGE_OPTIONS = [
  { label: 'Last month', value: EDateRange.LastMonth },
  { label: 'Last 3 months', value: EDateRange.Last3Months },
  { label: 'Custom', value: EDateRange.Custom },
];

function BulkExportHistoryContent({
  route,
}: IPageScreenProps<
  IModalBulkExportHistoryParamList,
  EModalBulkExportHistoryRoutes.BulkExportHistoryModal
>) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const actions = useAccountSelectorActions();
  const { networkId: homeNetworkId } = route.params;

  useEffect(() => {
    void actions.current.syncFromScene({
      from: {
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
        sceneNum: 0,
      },
      num: 0,
    });
  }, [actions]);

  const [dateRange, setDateRange] = useState<string | number>(
    EDateRange.LastMonth,
  );
  const [hideRiskyTransactions, setHideRiskyTransactions] = useState(true);
  const {
    supportedNetworkIds,
    selectedNetworkIds,
    setSelectedNetworkIds,
    hasRangeData,
    isLoading,
    isRangeLoading,
  } = useBulkExportHistorySupportedNetworks({
    homeNetworkId,
  });

  const isDateRangeDisabled = useMemo(
    () => isRangeLoading || !hasRangeData,
    [hasRangeData, isRangeLoading],
  );

  const handleCancel = useCallback(() => {
    navigation.pop();
  }, [navigation]);

  const handleOpenNetworkSelector = useCallback(() => {
    navigation.push(
      EModalBulkExportHistoryRoutes.BulkExportHistorySelectNetworks,
      {
        supportedNetworkIds,
        selectedNetworkIds,
        onSelectedNetworkIdsChange: setSelectedNetworkIds,
      },
    );
  }, [
    navigation,
    selectedNetworkIds,
    setSelectedNetworkIds,
    supportedNetworkIds,
  ]);

  const handleExport = useCallback(() => {
    // TODO: implement export
  }, []);

  if (isLoading) {
    return (
      <Page>
        <Page.Header
          title={intl.formatMessage({
            id: ETranslations.global_export_transaction_history,
          })}
        />
        <Page.Body flex={1} alignItems="center" justifyContent="center">
          <Spinner size="large" />
        </Page.Body>
      </Page>
    );
  }

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.global_export_transaction_history,
        })}
      />
      <Page.Body px="$5" pt="$3" gap="$6">
        {/* Export Account */}
        <Stack gap="$1.5">
          <SizableText size="$bodyMdMedium">
            {intl.formatMessage({ id: ETranslations.global_account })}
          </SizableText>
          <AccountSelectorTriggerBulkExportHistory num={0} />
        </Stack>

        {/* Network */}
        <Stack gap="$1.5">
          <SizableText size="$bodyMdMedium">
            {intl.formatMessage({ id: ETranslations.global_network })}
          </SizableText>
          <BulkExportHistoryNetworkTrigger
            selectedNetworkIds={selectedNetworkIds}
            onPress={handleOpenNetworkSelector}
          />
        </Stack>

        {/* Date Range */}
        <Stack gap="$1.5">
          <SizableText size="$bodyMdMedium">
            {intl.formatMessage({
              id: ETranslations.global_select_date_range,
            })}
          </SizableText>
          <Stack
            opacity={isDateRangeDisabled ? 0.5 : 1}
            pointerEvents={isDateRangeDisabled ? 'none' : 'auto'}
          >
            <SegmentControl
              fullWidth
              value={dateRange}
              options={DATE_RANGE_OPTIONS}
              onChange={setDateRange}
            />
          </Stack>
        </Stack>

        {/* Hide Risky Transactions */}
        <XStack alignItems="center" py="$2" gap="$3">
          <SizableText size="$bodyLgMedium" flex={1}>
            {intl.formatMessage({
              id: ETranslations.wallet_history_settings_hide_risk_transaction_title,
            })}
          </SizableText>
          <Switch
            size={ESwitchSize.small}
            value={hideRiskyTransactions}
            onChange={setHideRiskyTransactions}
          />
        </XStack>
      </Page.Body>
      <Page.Footer>
        <Page.FooterActions
          onCancelText={intl.formatMessage({
            id: ETranslations.global_cancel,
          })}
          cancelButtonProps={{
            onPress: handleCancel,
          }}
          onConfirmText={intl.formatMessage({
            id: ETranslations.global_bulk_copy_addresses_export_csv,
          })}
          confirmButtonProps={{
            onPress: handleExport,
            disabled: !hasRangeData,
          }}
        />
      </Page.Footer>
    </Page>
  );
}

function BulkExportHistory(
  props: IPageScreenProps<
    IModalBulkExportHistoryParamList,
    EModalBulkExportHistoryRoutes.BulkExportHistoryModal
  >,
) {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.bulkExportHistory,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <BulkExportHistoryContent {...props} />
    </AccountSelectorProviderMirror>
  );
}

export default BulkExportHistory;
