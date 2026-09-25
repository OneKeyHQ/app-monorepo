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
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { OnboardingTestIDs } from '../../views/Onboardingv2/testIDs';
import { WalletConnectDappConnectionProgress } from '../WalletConnect/WalletConnectDappConnectionProgress';

export function ConnectToWalletDialogContent({
  isWalletConnect,
  onSocketProgressExhausted,
  onRetryPress,
}: {
  isWalletConnect: boolean;
  onSocketProgressExhausted: () => Promise<void>;
  onRetryPress: () => void;
}) {
  const [loading] = useOnboardingConnectWalletLoadingAtom();
  const intl = useIntl();
  // WalletConnect prepares a pairing URI before showing the wallet picker.
  const loadingMessageId = isWalletConnect
    ? ETranslations.global_preparing
    : ETranslations.global_connect_to_wallet_confirm_to_proceed;
  const errorMessageId = isWalletConnect
    ? ETranslations.global_connection_failed
    : ETranslations.global_connect_to_wallet_no_confirmation;

  if (platformEnv.isNative && isWalletConnect && loading) {
    return (
      <WalletConnectDappConnectionProgress
        onExhausted={onSocketProgressExhausted}
      />
    );
  }

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
          {intl.formatMessage({
            id: loading ? loadingMessageId : errorMessageId,
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
