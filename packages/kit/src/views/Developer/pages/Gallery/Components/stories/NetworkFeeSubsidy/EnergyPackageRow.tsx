import {
  Button,
  SizableText,
  Toast,
  XStack,
  YStack,
  useInModalDialog,
} from '@onekeyhq/components';

import { getPurchasedUnits } from './energyPackageDemo';
import { EnergyPackagePurchase } from './EnergyPackagePurchase';
import { LoginRequiredBadge } from './LoginRequiredBadge';

import type { IEnergyPackageDemo } from './energyPackageDemo';

export function EnergyPackageRow({
  signedIn,
  state,
  onLogin,
  onPurchase,
}: {
  signedIn: boolean;
  state: IEnergyPackageDemo;
  onLogin: (onSuccess?: () => void) => void;
  onPurchase: (units: number) => void;
}) {
  const dialog = useInModalDialog();
  const purchasedUnits = getPurchasedUnits(state);
  const remainingUnits = state.giftUnits + purchasedUnits;
  const hasPackage = signedIn && (state.isPrime || state.purchases.length > 0);

  const showPurchase = () => {
    const purchaseDialog = dialog.show({
      title: '购买能量包',
      boundedSheetLayout: true,
      showFooter: false,
      renderContent: (
        <EnergyPackagePurchase
          onComplete={async (units) => {
            await purchaseDialog.close();
            onPurchase(units);
            Toast.success({
              title: '模拟购买成功',
              message: `新增 ${units} 份，当前剩余 ${remainingUnits + units} 份。未产生实际扣款。`,
            });
          }}
        />
      ),
    });
  };

  const startPurchase = () => {
    if (!signedIn) {
      onLogin(showPurchase);
      return;
    }
    showPurchase();
  };

  return (
    <XStack p="$4" gap="$3" alignItems="center" flexWrap="wrap">
      <YStack flex={1} minWidth={160} gap="$2">
        <SizableText size="$bodyMdMedium">能量包</SizableText>
        {hasPackage ? (
          <SizableText
            size="$bodySm"
            color="$textSubdued"
            testID="energy-package-remaining"
          >
            剩余{' '}
            <SizableText size="$bodySmMedium" color="$text">
              {remainingUnits}
            </SizableText>{' '}
            份
          </SizableText>
        ) : (
          <SizableText size="$bodySm" color="$textSubdued">
            Prime 每月赠送，也可单独购买
          </SizableText>
        )}
      </YStack>
      {signedIn ? (
        <Button
          testID="subsidy-buy-energy-package"
          size="small"
          variant="primary"
          flexShrink={0}
          onPress={startPurchase}
        >
          购买
        </Button>
      ) : (
        <LoginRequiredBadge />
      )}
    </XStack>
  );
}
