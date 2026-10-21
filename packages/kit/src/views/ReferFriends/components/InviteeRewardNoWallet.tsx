import { useIntl } from 'react-intl';

import type { IIllustrationName } from '@onekeyhq/components';
import { Button, Empty, YStack } from '@onekeyhq/components';
import { useToOnBoardingPage } from '@onekeyhq/kit/src/views/Onboarding/hooks/useToOnBoardingPage';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function InviteeRewardNoWallet({
  testID,
  onBeforeNavigate,
  illustration,
  title,
}: {
  testID: string;
  onBeforeNavigate?: () => void | Promise<void>;
  // Page hosts pass their own copy; dialogs keep the bind-code wording.
  illustration?: IIllustrationName;
  title?: string;
}) {
  const intl = useIntl();
  const toOnBoardingPage = useToOnBoardingPage();

  return (
    <YStack flex={1} jc="center" ai="center" py="$10">
      {title ? (
        <Empty illustration={illustration} title={title} />
      ) : (
        <Empty
          icon="WalletOutline"
          title={intl.formatMessage({
            id: ETranslations.referral_apply_code_no_wallet,
          })}
          description={intl.formatMessage({
            id: ETranslations.referral_apply_code_no_wallet_desc,
          })}
        />
      )}
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
