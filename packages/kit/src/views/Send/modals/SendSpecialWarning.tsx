import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Box, Center, Icon, Typography } from '@onekeyhq/components';

import { closeExtensionWindowIfOnboardingFinished } from '../../../hooks/useOnboardingRequired';
import { BaseSendModal } from '../components/BaseSendModal';
import { DecodeTxButtonTest } from '../components/DecodeTxButtonTest';
import { SendModalRoutes } from '../types';
import { useSendConfirmRouteParamsParsed } from '../utils/useSendConfirmRouteParamsParsed';

import type { SendRoutesParams } from '../types';
import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<
  SendRoutesParams,
  SendModalRoutes.SendSpecialWarning
>;

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
      hideSecondaryAction
      onPrimaryActionPress={() => {
        sendConfirmParamsParsed.navigation.navigate(
          SendModalRoutes.SendAuthentication,
          params,
        );
      }}
    >
      <Center flex={1}>
        <DecodeTxButtonTest
          accountId={accountId}
          networkId={networkId}
          encodedTx={params.encodedTx}
        />
        <Box
          mb="16px"
          p="12px"
          rounded="full"
          bgColor="surface-warning-subdued"
        >
          <Icon name="ExclamationTriangleOutline" color="icon-warning" />
        </Box>
        <Typography.Body1 textAlign="center">
          {intl.formatMessage(
            {
              // @ts-expect-error
              id: params.hintMsgKey,
            },
            params.hintMsgParams,
          )}
        </Typography.Body1>
      </Center>
    </BaseSendModal>
  );
};
