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

export function ConnectToWalletDialogContent({
  onRetryPress,
}: {
  onRetryPress: () => void;
}) {
  const [loading] = useOnboardingConnectWalletLoadingAtom();
  const intl = useIntl();

  return (
    <Stack>
      <Stack
        justifyContent="center"
        alignItems="center"
        p="$5"
        bg="$bgStrong"
        borderRadius="$3"
        borderCurve="continuous"
      >
        {loading ? (
          <Spinner size="large" />
        ) : (
          <Icon size="$9" name="BrokenLink2Outline" />
        )}

        <SizableText textAlign="center" pt="$4">
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
