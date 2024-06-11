import { useIntl } from 'react-intl';

import {
  IconButton,
  SizableText,
  Stack,
  Tooltip,
  useMedia,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EOnboardingPages } from '@onekeyhq/shared/src/routes';

import { useAccountSelectorRoute } from '../../../router/useAccountSelectorRoute';

export function AccountSelectorCreateWalletButton() {
  const media = useMedia();
  const intl = useIntl();

  const navigation = useAppNavigation();
  const route = useAccountSelectorRoute();
  // const linkNetwork = route.params?.linkNetwork;
  const isEditableRouteParams = route.params?.editable;

  if (!isEditableRouteParams) {
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const onboardingButton = (
    <IconButton
      onPress={() => {
        navigation.pushModal(EModalRoutes.OnboardingModal, {
          screen: EOnboardingPages.GetStarted,
        });
      }}
      icon="PlusSmallOutline"
      testID="add-wallet"
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
