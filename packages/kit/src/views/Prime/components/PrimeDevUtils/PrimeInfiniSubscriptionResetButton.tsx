/* cspell:ignore Infini */
import { Button, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { showDevOnlyPasswordDialog } from '@onekeyhq/kit/src/views/Setting/pages/Tab/DevSettingsSection/showDevOnlyPasswordDialog';
import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

export function PrimeInfiniSubscriptionResetButton({
  testID = 'prime-infini-reset-subscription',
  onReset,
}: {
  testID?: string;
  // Awaited after the reset so the caller can refetch whatever it renders:
  // apiFetchPrimeUserInfo alone does not refresh a page whose subscription
  // comes from its own apiGetInfiniSubscription call.
  onReset?: () => Promise<void>;
}) {
  const [primeUserInfo] = usePrimePersistAtom();
  const expectedOneKeyUserId = primeUserInfo.onekeyUserId;

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
            if (!expectedOneKeyUserId) {
              throw new OneKeyLocalError('OneKey ID not found');
            }
            await backgroundApiProxy.servicePrime.apiResetInfiniSubscription(
              params,
              { expectedOneKeyUserId },
            );
            // The reset just invalidated the server state, so bypass the
            // short TTL instead of reading a pre-reset cached user info.
            await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo({
              forceRefresh: true,
            });
            await onReset?.();
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
