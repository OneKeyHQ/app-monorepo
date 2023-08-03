import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  Form,
  Modal,
  Text,
  ToastManager,
  useForm,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { FormatCurrencyTokenOfAccount } from '@onekeyhq/kit/src/components/Format';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNativeToken, useNavigation, useNetwork } from '../../../hooks';
import { LNModalDescription } from '../components/LNModalDescription';

import type { SendRoutesParams } from '../../../routes';
import type { SendModalRoutes } from '../../../routes/routesEnum';
import type { ModalScreenProps } from '../../../routes/types';
import type { SendFeedbackReceiptParams } from '../../Send/types';
import type { RouteProp } from '@react-navigation/core';

type NavigationProps = ModalScreenProps<SendRoutesParams>;
type RouteProps = RouteProp<SendRoutesParams, SendModalRoutes.LNURLAuth>;

type FormValues = {
  amount: string;
  description: string;
  connectTo: string;
};

const LNURLAuth = () => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const { networkId, accountId, lnurlDetails } = route.params ?? {};
  const { network } = useNetwork({ networkId });
  const { control, handleSubmit, watch } = useForm<FormValues>();
  const amountValue = watch('amount');

  const nativeToken = useNativeToken(networkId);

  const [isLoading, setIsLoading] = useState(false);

  return (
    <Modal
      header={intl.formatMessage({ id: 'title__lnurl_withdraw' })}
      headerDescription={<LNModalDescription networkId={networkId} />}
      primaryActionTranslationId="action__withdraw"
      primaryActionProps={{
        isDisabled: isLoading,
        isLoading,
      }}
      onPrimaryActionPress={() => {}}
      secondaryActionTranslationId="action__cancel"
      onSecondaryActionPress={() => {
        if (navigation?.canGoBack?.()) {
          navigation.goBack();
        }
      }}
      height="auto"
      scrollViewProps={{
        contentContainerStyle: {
          flex: 1,
          paddingVertical: isVerticalLayout ? 16 : 24,
        },
        children: (
          <Box>
            <Text>Hello World</Text>
          </Box>
        ),
      }}
    />
  );
};

export default LNURLAuth;
