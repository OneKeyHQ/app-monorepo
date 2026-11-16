import { useCallback, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, YStack, useDialogInstance } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimeGiftPages } from '@onekeyhq/shared/src/routes/prime';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';

import { getPrimeGiftDurationText } from './primeGiftDuration';

import type { IPrimeGiftClaimableDevice } from './primeGiftClaimableDevices';

function PrimeGiftDeviceSelection({
  devices,
  onSelected,
}: {
  devices: IPrimeGiftClaimableDevice[];
  onSelected: (item: IPrimeGiftClaimableDevice) => void;
}) {
  const intl = useIntl();
  const dialog = useDialogInstance();
  const selecting = useRef(false);
  const select = useCallback(
    async (item: IPrimeGiftClaimableDevice) => {
      if (selecting.current) return;
      selecting.current = true;
      try {
        await dialog.close();
      } catch {
        selecting.current = false;
        return;
      }
      onSelected(item);
    },
    [dialog, onSelected],
  );
  return (
    <Dialog.ScrollView maxHeight={360}>
      <YStack>
        {devices.map((item) => {
          const duration = getPrimeGiftDurationText(item.eligibility, intl);
          const serial = `SN ••••${item.serialNo.slice(-4)}`;
          return (
            <ListItem
              key={item.serialNo}
              testID={`prime-gift-select-${item.serialNo}`}
              title={
                item.wallet.name?.trim() ||
                item.device.name?.trim() ||
                'OneKey Pro 2'
              }
              subtitle={duration ? `${serial} · ${duration}` : serial}
              renderAvatar={() => <WalletAvatar wallet={item.wallet} />}
              drillIn
              onPress={() => select(item)}
            />
          );
        })}
      </YStack>
    </Dialog.ScrollView>
  );
}

export function useOpenPrimeGiftClaim() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const deviceSelectionOpenRef = useRef(false);
  return useCallback(
    (devices: IPrimeGiftClaimableDevice[]) => {
      if (!devices.length || deviceSelectionOpenRef.current) return;
      defaultLogger.prime.subscription.primeGiftOfferClick({
        source: 'primeDashboard',
        deviceCount: devices.length,
      });
      const openClaim = (item: IPrimeGiftClaimableDevice) => {
        navigation.pushModal(EModalRoutes.PrimeGiftModal, {
          screen: EPrimeGiftPages.PrimeGift,
          params: {
            device: deviceUtils.dbDeviceToSearchDevice(item.device),
            serialNo: item.serialNo,
            source: 'primeDashboard',
          },
        });
      };
      if (devices.length === 1) {
        openClaim(devices[0]);
        return;
      }
      deviceSelectionOpenRef.current = true;
      Dialog.show({
        title: intl.formatMessage({
          id: ETranslations.prime_gift_choose_pro2__title,
        }),
        showFooter: false,
        contentContainerProps: { px: 0 },
        onClose: () => {
          deviceSelectionOpenRef.current = false;
        },
        renderContent: (
          <PrimeGiftDeviceSelection devices={devices} onSelected={openClaim} />
        ),
      });
    },
    [intl, navigation],
  );
}
