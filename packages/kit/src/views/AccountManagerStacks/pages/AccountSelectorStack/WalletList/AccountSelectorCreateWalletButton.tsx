import { useIntl } from 'react-intl';

import { IconButton, SizableText, Stack } from '@onekeyhq/components';
import { useToOnBoardingPage } from '@onekeyhq/kit/src/views/Onboarding/pages';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useAccountSelectorRoute } from '../../../router/useAccountSelectorRoute';

export function AccountSelectorCreateWalletButton() {
  const intl = useIntl();

  const route = useAccountSelectorRoute();
  const toOnBoardingPage = useToOnBoardingPage();
  // const linkNetwork = route.params?.linkNetwork;
  const isEditableRouteParams = route.params?.editable;

  if (!isEditableRouteParams) {
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const onboardingButton = (
    <IconButton
      onPress={() => {
        void toOnBoardingPage({
          params: {
            showCloseButton: true,
          },
        });
      }}
      icon="PlusSmallOutline"
      testID="account-add-wallet"
    />
  );
  return (
    <Stack p="$1" alignItems="center">
      <IconButton
        onPress={() => {
          void toOnBoardingPage({
            params: {
              showCloseButton: true,
            },
          });
        }}
        icon="PlusSmallOutline"
        testID="add-wallet"
      />
      <SizableText
        textAlign="center"
        size="$bodySm"
        color="$textSubdued"
        mt="$1"
      >
        {intl.formatMessage({ id: ETranslations.global_add_wallet })}
      </SizableText>
    </Stack>
  );
}
