import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Empty, Page, ScrollView, YStack } from '@onekeyhq/components';
import HeaderIconButton from '@onekeyhq/components/src/layouts/Navigation/Header/HeaderIconButton';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IAddressRiskCheckRecentItem } from '@onekeyhq/shared/types/addressRiskCheck';

import { RecentCheckItem } from '../components/RecentCheckItem';
import { useCheckAddressRisk } from '../hooks/useCheckAddressRisk';
import { useRecentChecks } from '../hooks/useRecentChecks';

function AddressRiskCheckHistory() {
  const intl = useIntl();
  const { items, networkNameMap, deleteOne, clearAll } = useRecentChecks();
  const { checkRisk } = useCheckAddressRisk();

  const handlePress = useCallback(
    (item: IAddressRiskCheckRecentItem) => {
      void checkRisk({
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
      items.length ? (
        <HeaderIconButton icon="BroomOutline" onPress={handleClearAll} />
      ) : null,
    [items.length, handleClearAll],
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
        {items.length ? (
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
        ) : (
          <Empty
            icon="ClockTimeHistoryOutline"
            title={intl.formatMessage({
              id: ETranslations.address_risk_check_history_empty__title,
            })}
            description={intl.formatMessage({
              id: ETranslations.address_risk_check_history_empty__desc,
            })}
          />
        )}
      </Page.Body>
    </Page>
  );
}

export default AddressRiskCheckHistory;
