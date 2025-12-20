import { useCallback } from 'react';

import type { IAlertProps, IStackStyle } from '@onekeyhq/components';
import { Alert, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSpotlightPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IEarnAlert, IEarnText } from '@onekeyhq/shared/types/staking';

import { EarnText } from './EarnText';

function EarnAlertItem({
  alert: alertItem,
  key,
  closable,
  onClose,
}: {
  alert: IEarnAlert;
  key: string;
  closable?: IAlertProps['closable'];
  onClose?: IAlertProps['onClose'];
}) {
  return (
    <Alert
      key={key}
      closable={closable}
      onClose={onClose}
      type={alertItem.badge}
      renderTitle={(props) => {
        return (
          <EarnText
            {...props}
            text={
              typeof alertItem.alert === 'string'
                ? { text: alertItem.alert }
                : (alertItem.alert as IEarnText)
            }
          />
        );
      }}
      action={
        alertItem.button
          ? {
              primary: alertItem.button.text.text,
              onPrimaryPress: () => {
                if (alertItem.button?.data?.link) {
                  openUrlExternal(alertItem.button.data.link);
                }
              },
            }
          : undefined
      }
    />
  );
}

export function EarnAlertClosableItem({
  alert: alertItem,
  key,
}: {
  alert: IEarnAlert;
  key: string;
}) {
  const [{ data }] = useSpotlightPersistAtom();
  const times = data[alertItem.key] || 0;
  const handleClose = useCallback(async () => {
    void backgroundApiProxy.serviceSpotlight.updateTourTimes({
      tourName: alertItem.key,
      manualTimes: 1,
    });
  }, [alertItem.key]);
  return times === 0 ? (
    <EarnAlertItem closable key={key} alert={alertItem} onClose={handleClose} />
  ) : null;
}

export function EarnAlert({ alerts }: { alerts?: IEarnAlert[] }) {
  if (alerts?.length) {
    return (
      <YStack gap="$1.5" flex={1}>
        {alerts.map((alertItem, index) => {
          return alertItem.key ? (
            <EarnAlertClosableItem
              alert={alertItem}
              key={`${alertItem.alert}-${index}`}
            />
          ) : (
            <EarnAlertItem
              key={`${alertItem.alert}-${index}`}
              alert={alertItem}
            />
          );
        })}
      </YStack>
    );
  }
  return null;
}
