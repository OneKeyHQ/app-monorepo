import { useIntl } from 'react-intl';

import { Button, Empty, YStack } from '@onekeyhq/components';
import { useToOnBoardingPage } from '@onekeyhq/kit/src/views/Onboarding/hooks/useToOnBoardingPage';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function InviteeRewardNoWallet({
  testID,
  onBeforeNavigate,
}: {
  testID: string;
  onBeforeNavigate?: () => void | Promise<void>;
}) {
  const intl = useIntl();
  const toOnBoardingPage = useToOnBoardingPage();

  return (
    <YStack flex={1} jc="center" ai="center" py="$10">
      <Empty
        icon="WalletOutline"
        title={intl.formatMessage({
          id: ETranslations.referral_apply_code_no_wallet,
        })}
        description={intl.formatMessage({
          id: ETranslations.referral_apply_code_no_wallet_desc,
        })}
      />
      <Button
        testID={testID}
        mt="$5"
        onPress={async () => {
          await onBeforeNavigate?.();
          await toOnBoardingPage();
        }}
      >
        {intl.formatMessage({
          id: platformEnv.isWebDappMode
            ? ETranslations.global_connect_wallet
            : ETranslations.global_create_wallet,
        })}
      </Button>
    </YStack>
  );
}
