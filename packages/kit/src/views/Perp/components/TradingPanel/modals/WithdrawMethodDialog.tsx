import {
  Dialog,
  type IDialogInstance,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { usePerpsCommonConfigPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { USDC_WITHDRAW_DESTINATIONS } from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import { PerpTransferMethodRow } from './PerpTransferMethodRow';

function WithdrawNetworkIcons() {
  const [{ perpConfigCommon }] = usePerpsCommonConfigPersistAtom();
  const destinations = USDC_WITHDRAW_DESTINATIONS.filter(
    ({ id }) =>
      perpConfigCommon.withdrawChannel !== 'legacy' || id === 'arbitrum',
  );
  const visible = destinations.slice(0, 3);
  return (
    <XStack alignItems="center" flexShrink={0}>
      {visible.map((destination, index) => (
        <Stack
          key={destination.id}
          ml={index ? '$-1' : undefined}
          borderWidth="$px"
          borderColor="$bgApp"
          borderRadius="$full"
          accessibilityLabel={destination.name}
        >
          <NetworkAvatar networkId={destination.networkId} size="$4.5" />
        </Stack>
      ))}
      {destinations.length > visible.length ? (
        <SizableText size="$bodyXs" color="$textSubdued" ml="$1">
          +{destinations.length - visible.length}
        </SizableText>
      ) : null}
    </XStack>
  );
}

export function showWithdrawMethodDialog({
  walletName,
  onWithdraw,
  onSend,
  isTransferDisabled,
}: {
  walletName: string;
  onWithdraw: () => Promise<void>;
  onSend: () => Promise<void>;
  isTransferDisabled: boolean;
}) {
  const holder: { instance?: IDialogInstance } = {};
  let selecting = false;
  const select = async (action: () => Promise<void>) => {
    if (selecting) return;
    selecting = true;
    try {
      await holder.instance?.close();
      await action();
    } finally {
      selecting = false;
    }
  };
  holder.instance = Dialog.show({
    title: 'Select Method',
    showFooter: false,
    floatingPanelProps: { width: 440, maxWidth: 'calc(100vw - 32px)' },
    contentContainerProps: platformEnv.isNative ? { pb: 0 } : undefined,
    renderContent: (
      <YStack
        gap="$2"
        pb={platformEnv.isNative ? '$1' : undefined}
        width="100%"
      >
        <PerpTransferMethodRow
          testID="perps-withdraw-method-asset"
          icon="WalletCryptoOutline"
          hint={<WithdrawNetworkIcons />}
          title={`Transfer to ${walletName}`}
          subtitle="Withdraw from Hyperliquid to your wallet."
          onPress={() => select(onWithdraw)}
        />
        <PerpTransferMethodRow
          testID="perps-withdraw-method-send"
          icon="SendOutline"
          title="Send to Hyperliquid User"
          subtitle="Send tokens within Hyperliquid."
          disabled={isTransferDisabled}
          onPress={() => select(onSend)}
        />
      </YStack>
    ),
  });
  return holder.instance;
}
