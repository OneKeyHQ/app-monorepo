import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Box, Center, Image, Typography } from '@onekeyhq/components';
import WalletWarning from '@onekeyhq/kit/assets/wallet/ic_backup_wallet_manual_warning.png';

import { closeExtensionWindowIfOnboardingFinished } from '../../../hooks/useOnboardingRequired';
import { BaseSendModal } from '../components/BaseSendModal';
import { DecodeTxButtonTest } from '../components/DecodeTxButtonTest';
import { SendRoutes } from '../types';
import { useSendConfirmRouteParamsParsed } from '../utils/useSendConfirmRouteParamsParsed';

import type { SendRoutesParams } from '../types';
import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<SendRoutesParams, SendRoutes.SendSpecialWarning>;

// Remind whether to continue
export const SendSpecialWarning = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { params } = route;
  const { onModalClose, networkId, accountId } = params;
  const sendConfirmParamsParsed = useSendConfirmRouteParamsParsed();

  // TODO all Modal close should reject dapp call
  return (
    <BaseSendModal
      accountId={accountId}
      networkId={networkId}
      header={intl.formatMessage({ id: 'title__warning' })}
      primaryActionTranslationId="action__confirm"
      onModalClose={() => {
        onModalClose?.();
        closeExtensionWindowIfOnboardingFinished();
      }}
      onSecondaryActionPress={() => {
        onModalClose?.();
        closeExtensionWindowIfOnboardingFinished();
      }}
      onPrimaryActionPress={() => {
        sendConfirmParamsParsed.navigation.navigate(
          SendRoutes.SendAuthentication,
          params,
        );
      }}
    >
      <Box flex={1}>
        <DecodeTxButtonTest
          accountId={accountId}
          networkId={networkId}
          encodedTx={params.encodedTx}
        />
        <Center mb={8}>
          <Image size="100px" source={WalletWarning} />
        </Center>
        <Typography.Body1 textAlign="center">
          {intl.formatMessage(
            {
              // @ts-expect-error
              id: params.hintMsgKey,
            },
            params.hintMsgParams,
          )}
        </Typography.Body1>
      </Box>
    </BaseSendModal>
  );
};
