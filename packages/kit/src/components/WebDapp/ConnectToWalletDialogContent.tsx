import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  SizableText,
  Spinner,
  Stack,
} from '@onekeyhq/components';
import { useOnboardingConnectWalletLoadingAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';

import { OnboardingTestIDs } from '../../views/Onboardingv2/testIDs';

export function ConnectToWalletDialogContent({
  onRetryPress,
}: {
  onRetryPress: () => void;
}) {
  const [loading] = useOnboardingConnectWalletLoadingAtom();
  const intl = useIntl();

  return (
    <Stack testID={OnboardingTestIDs.connectExternalWalletLoadingDialog}>
      <Stack
        justifyContent="center"
        alignItems="center"
        p="$5"
        bg="$bgStrong"
        borderRadius="$3"
        borderCurve="continuous"
      >
        {loading ? (
          <Spinner
            size="large"
            testID={OnboardingTestIDs.connectExternalWalletLoadingSpinner}
          />
        ) : (
          <Icon size="$9" name="BrokenLink2Outline" />
        )}

        <SizableText
          testID={OnboardingTestIDs.connectExternalWalletLoadingMessage}
          textAlign="center"
          pt="$4"
        >
          {loading
            ? intl.formatMessage({
                id: ETranslations.global_connect_to_wallet_confirm_to_proceed,
              })
            : intl.formatMessage({
                id: ETranslations.global_connect_to_wallet_no_confirmation,
              })}
        </SizableText>
      </Stack>
      {loading ? null : (
        <Button
          testID="web-dapp-intl-btn"
          mt="$5"
          variant="primary"
          size="large"
          $gtMd={{
            size: 'medium',
          }}
          onPress={onRetryPress}
        >
          {intl.formatMessage({ id: ETranslations.global_retry })}
        </Button>
      )}
    </Stack>
  );
}
