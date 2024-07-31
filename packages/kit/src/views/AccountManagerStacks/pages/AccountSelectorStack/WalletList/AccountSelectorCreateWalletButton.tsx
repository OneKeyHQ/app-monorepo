import { useIntl } from 'react-intl';

import {
  IconButton,
  SizableText,
  Stack,
  Tooltip,
  useMedia,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useToOnBoardingPage } from '@onekeyhq/kit/src/views/Onboarding/pages';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useAccountSelectorRoute } from '../../../router/useAccountSelectorRoute';

export function AccountSelectorCreateWalletButton() {
  const media = useMedia();
  const intl = useIntl();

  const navigation = useAppNavigation();
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
      {media.gtMd ? (
        <>
          {onboardingButton}
          <SizableText size="$bodySm" color="$textSubdued" mt="$1">
            {intl.formatMessage({ id: ETranslations.global_add_wallet })}
          </SizableText>
        </>
      ) : (
        <Tooltip
          renderContent={intl.formatMessage({
            id: ETranslations.global_add_wallet,
          })}
          renderTrigger={onboardingButton}
          placement="right"
        />
      )}
    </Stack>
  );
}
