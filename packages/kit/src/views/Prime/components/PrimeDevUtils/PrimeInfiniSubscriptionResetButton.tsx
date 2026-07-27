/* cspell:ignore Infini */
import { Button, Dialog, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

export function PrimeInfiniSubscriptionResetButton({
  testID = 'prime-infini-reset-subscription',
}: {
  testID?: string;
}) {
  return (
    <Button
      variant="destructive"
      testID={testID}
      onPress={() => {
        Dialog.confirm({
          title: 'Reset Infini Subscription',
          description:
            "Permanently delete the current Prime user's Infini subscription so the subscription flow can be tested again?",
          confirmButtonProps: {
            variant: 'destructive',
          },
          onConfirm: async () => {
            await backgroundApiProxy.servicePrime.apiResetInfiniSubscription();
            await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
            Toast.success({
              title: 'Infini subscription reset',
            });
          },
        });
      }}
    >
      apiResetInfiniSubscription
    </Button>
  );
}
