/* cspell:ignore Infini */
import { Button, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { showDevOnlyPasswordDialog } from '@onekeyhq/kit/src/views/Setting/pages/Tab/DevSettingsSection/showDevOnlyPasswordDialog';

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
        // This entry is reachable in production builds, so the destructive
        // reset is gated behind the devOnlyPassword prompt instead of a plain
        // confirmation dialog.
        showDevOnlyPasswordDialog({
          title: 'Reset Infini Subscription',
          description:
            "Permanently delete the current Prime user's Infini subscription so the subscription flow can be tested again?",
          onConfirm: async (params) => {
            await backgroundApiProxy.servicePrime.apiResetInfiniSubscription(
              params,
            );
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
