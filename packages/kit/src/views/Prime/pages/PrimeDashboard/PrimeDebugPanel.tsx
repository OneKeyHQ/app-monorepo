import { Button, Dialog, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePrimeAuthV2 } from '@onekeyhq/kit/src/views/Prime/hooks/usePrimeAuthV2';
import { usePrimePayment } from '@onekeyhq/kit/src/views/Prime/hooks/usePrimePayment';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';

function showDebugMessageByDialog(obj: any) {
  Dialog.debugMessage({
    debugMessage: obj,
  });
}

export function PrimeDebugPanel({
  shouldShowConfirmButton,
}: {
  shouldShowConfirmButton: boolean;
}) {
  const { getAccessToken, logout, isReady, authenticated } = usePrimeAuthV2();
  const { getCustomerInfo } = usePrimePayment();
  const navigation = useAppNavigation();

  return (
    <XStack flexWrap="wrap">
      <Button
        onPress={() => {
          void logout();
        }}
      >
        Logout
      </Button>
      <Button
        onPress={() => {
          void getAccessToken().then(showDebugMessageByDialog);
        }}
      >
        Get Access Token
      </Button>
      <Button
        onPress={() => {
          showDebugMessageByDialog({
            ready: isReady,
            authenticated,
          });
        }}
      >
        User Info
      </Button>
      <Button>
        shouldShowConfirmButton={shouldShowConfirmButton.toString()}
      </Button>
      <Button
        onPress={() => {
          void getCustomerInfo().then(showDebugMessageByDialog);
        }}
      >
        CustomerInfo
      </Button>
      <Button
        onPress={() => {
          void backgroundApiProxy.servicePrime
            .apiFetchPrimeUserInfo()
            .then(showDebugMessageByDialog);
        }}
      >
        ServerPrimeUserInfo
      </Button>
      <Button
        onPress={() => {
          navigation.pushFullModal(EModalRoutes.PrimeModal, {
            screen: EPrimePages.PrimeDeviceLimit,
          });
        }}
      >
        DeviceLimit
      </Button>
    </XStack>
  );
}
