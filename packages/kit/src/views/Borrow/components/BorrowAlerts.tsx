import { memo, useCallback } from 'react';

import type { IAlertProps } from '@onekeyhq/components';
import { Alert, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalReceiveRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';
import type {
  IBorrowAlert,
  IBorrowAlertButton,
} from '@onekeyhq/shared/types/staking';
import { swapDefaultSetTokens } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';

type IAlertActionButton = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

type IBorrowAlertsProps = {
  alerts?: IBorrowAlert[];
  accountId?: string;
  walletId?: string;
  indexedAccountId?: string;
  marketNetworkId?: string;
};

export const BorrowAlerts = memo(
  ({
    alerts,
    accountId,
    walletId,
    indexedAccountId,
    marketNetworkId,
  }: IBorrowAlertsProps) => {
    const navigation = useAppNavigation();
    const bridgeFromToken = swapDefaultSetTokens['evm--1']?.fromToken;
    const bridgeToToken = swapDefaultSetTokens['sol--101']?.fromToken;
    const alertItems = alerts ?? [];
    const hasAlerts = alertItems.length > 0;

    const handleReceivePress = useCallback(async () => {
      if (!marketNetworkId || !accountId || !walletId) {
        console.warn('Borrow alert receive action missing account context.');
        return;
      }

      try {
        const networkAccount =
          await backgroundApiProxy.serviceAccount.createAddressIfNotExists(
            {
              walletId,
              networkId: marketNetworkId,
              accountId,
              indexedAccountId,
            },
            {
              allowWatchAccount: true,
            },
          );

        if (!networkAccount) {
          console.warn('Borrow alert receive action missing network account.');
          return;
        }

        navigation.pushModal(EModalRoutes.ReceiveModal, {
          screen: EModalReceiveRoutes.ReceiveToken,
          params: {
            networkId: marketNetworkId,
            accountId: networkAccount.id,
            walletId,
            indexedAccountId,
          },
        });
      } catch (error) {
        console.error('Borrow alert receive action failed:', error);
      }
    }, [accountId, indexedAccountId, marketNetworkId, navigation, walletId]);

    const handleBridgePress = useCallback(() => {
      if (!bridgeFromToken || !bridgeToToken) {
        console.warn('Borrow alert bridge action missing swap tokens.');
        return;
      }

      navigation.pushModal(EModalRoutes.SwapModal, {
        screen: EModalSwapRoutes.SwapMainLand,
        params: {
          importFromToken: bridgeFromToken,
          importToToken: bridgeToToken,
          swapTabSwitchType: ESwapTabSwitchType.BRIDGE,
        },
      });
    }, [bridgeFromToken, bridgeToToken, navigation]);

    const resolveAlertButton = useCallback(
      (button?: IBorrowAlertButton): IAlertActionButton | null => {
        if (!button?.text?.text) {
          return null;
        }

        switch (button.type) {
          case 'receive':
            return {
              label: button.text.text,
              onPress: () => {
                void handleReceivePress();
              },
              disabled: button.disabled,
            };
          case 'bridge':
            return {
              label: button.text.text,
              onPress: () => {
                handleBridgePress();
              },
              disabled: button.disabled,
            };
          default:
            console.warn(
              `Unsupported borrow alert button type: ${button.type}`,
            );
            return null;
        }
      },
      [handleBridgePress, handleReceivePress],
    );

    const resolveAlertAction = useCallback(
      (buttons?: IBorrowAlertButton[]): IAlertProps['action'] => {
        if (!buttons?.length) return undefined;

        const mappedButtons = buttons
          .map((button) => resolveAlertButton(button))
          .filter((button): button is IAlertActionButton => button !== null);

        const primaryButton = mappedButtons[0];
        if (!primaryButton?.label) {
          return undefined;
        }

        const secondaryButton = mappedButtons[1];

        return {
          primary: primaryButton.label,
          onPrimaryPress: primaryButton.onPress,
          isPrimaryDisabled: primaryButton.disabled,
          primaryVariant: 'secondary',
          ...(secondaryButton?.label
            ? {
                secondary: secondaryButton.label,
                onSecondaryPress: secondaryButton.onPress,
                isSecondaryDisabled: secondaryButton.disabled,
                secondaryVariant: 'secondary',
              }
            : {}),
        };
      },
      [resolveAlertButton],
    );

    if (!hasAlerts) return null;

    return (
      <YStack gap="$3">
        {alertItems.map((alert, index) => (
          <Alert
            key={`${alert.title?.text ?? 'alert'}-${index}`}
            type={alert.badge}
            renderTitle={(props) => <EarnText {...props} text={alert.title} />}
            descriptionComponent={
              alert.description ? (
                <EarnText
                  text={alert.description}
                  size="$bodyMd"
                  color="$textSubdued"
                />
              ) : null
            }
            action={resolveAlertAction(alert.buttons)}
          />
        ))}
      </YStack>
    );
  },
);

BorrowAlerts.displayName = 'BorrowAlerts';
