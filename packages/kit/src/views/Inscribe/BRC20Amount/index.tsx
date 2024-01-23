import { useCallback, useMemo } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import uuidLib from 'react-native-uuid';

import {
  Box,
  Form,
  Modal,
  Text,
  ToastManager,
  useForm,
} from '@onekeyhq/components';
import type { IInscriptionContent } from '@onekeyhq/engine/src/vaults/impl/btc/inscribe/types';
import type { InscribeModalRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/Inscribe';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import { createBRC20TransferText } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAccount, useBRC20TokenBalance } from '../../../hooks';
import useDappApproveAction from '../../../hooks/useDappApproveAction';
import { InscribeModalRoutes } from '../../../routes/routesEnum';
import Steps from '../Components/Steps';
import { OrderButton } from '../OrderList';

import type { RouteProp } from '@react-navigation/core';

type NavigationProps = ModalScreenProps<InscribeModalRoutesParams>;

type RouteProps = RouteProp<
  InscribeModalRoutesParams,
  InscribeModalRoutes.BRC20Amount
>;

type BRC20AmountValues = {
  amount: string;
};

const BRC20_DEFAULT_DECIMALS = 1;

function BRC20Amount() {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const route = useRoute<RouteProps>();
  const {
    networkId,
    accountId,
    token,
    sourceInfo,
    amount: defaultAmount,
  } = route?.params || {};
  const { serviceInscribe } = backgroundApiProxy;
  const { account } = useAccount({ networkId, accountId });
  const { id } = sourceInfo ?? ({} as IDappSourceInfo);
  const dappApprove = useDappApproveAction({
    id,
  });

  const tokenBalance = useBRC20TokenBalance({
    networkId,
    accountId,
    token,
  });

  const { control, formState, getValues } = useForm<BRC20AmountValues>({
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      amount: defaultAmount ?? '',
    },
  });

  const isDisabled = useMemo(
    () => !formState.isValid || !account,
    [account, formState.isValid],
  );

  const onPromise = useCallback(async () => {
    const receiveAddress = account?.address;

    const { isTaprootAddress } = await serviceInscribe.checkValidTaprootAddress(
      {
        address: receiveAddress ?? '',
        networkId,
        accountId,
      },
    );

    if (!receiveAddress || !isTaprootAddress) {
      ToastManager.show(
        {
          title: intl.formatMessage({
            id: 'msg__invalid_address_ordinal_can_only_be_sent_to_taproot_address',
          }),
        },
        { type: 'error' },
      );
      return;
    }

    let contents: IInscriptionContent[] = [];
    const routeParams: InscribeModalRoutesParams[InscribeModalRoutes.CreateOrder] =
      {
        networkId,
        accountId,
        contents,
        size: 0,
        orderId: uuidLib.v4() as string,
        receiveAddress,
        sourceInfo,
      };

    const amount = getValues('amount');
    const brc20Text = createBRC20TransferText(amount, token?.symbol ?? '');
    if (brc20Text.length > 0) {
      try {
        contents = await serviceInscribe.createInscriptionContents({
          texts: [brc20Text],
        });
        Object.assign(routeParams, { size: brc20Text.length, contents });
      } catch (e: any) {
        const { key: errorKey = '', info } = e;
        if (errorKey === 'msg__file_size_should_less_than_str') {
          ToastManager.show(
            {
              title: intl.formatMessage({ id: errorKey }, info),
            },
            { type: 'error' },
          );
        }
      }
    }
    if (contents?.length > 0) {
      navigation.navigate(InscribeModalRoutes.CreateOrder, routeParams);
    }
  }, [
    account?.address,
    accountId,
    getValues,
    intl,
    navigation,
    networkId,
    serviceInscribe,
    sourceInfo,
    token?.symbol,
  ]);
  return (
    <Modal
      header={intl.formatMessage({ id: 'title__inscribe' })}
      headerDescription={
        <Text typography="Caption" color="text-subdued">{`${
          token?.name ?? ''
        } (brc20)`}</Text>
      }
      rightContent={<OrderButton />}
      height="640px"
      primaryActionTranslationId="action__next"
      hideSecondaryAction
      primaryActionProps={{
        onPromise,
        isDisabled,
      }}
      staticChildrenProps={{
        flex: 1,
        padding: '16px',
      }}
      onModalClose={dappApprove.reject}
    >
      <Steps numberOfSteps={2} currentStep={1} />

      <Box mt={6}>
        <Form>
          <Form.Item
            name="amount"
            label={intl.formatMessage({ id: 'form__amount' })}
            control={control}
            rules={{
              required: true,
              validate: (value) => {
                const amountBN = new BigNumber(value);
                if (amountBN.gt(tokenBalance.availableBalance ?? '0')) {
                  return intl.formatMessage({
                    id: 'msg__insufficient_balance',
                  });
                }

                if (amountBN.lte(0)) {
                  return false;
                }

                if (!amountBN.shiftedBy(BRC20_DEFAULT_DECIMALS).isInteger()) {
                  return intl.formatMessage(
                    {
                      id: 'msg__please_limit_the_amount_of_tokens_to_str_decimal_places_or_less',
                    },
                    {
                      '0': BRC20_DEFAULT_DECIMALS,
                    },
                  );
                }
              },
            }}
            helpText={`${intl.formatMessage({ id: 'form__available_colon' })} ${
              tokenBalance?.availableBalance ?? '0'
            }`}
          >
            <Form.NumberInput />
          </Form.Item>
        </Form>
      </Box>
    </Modal>
  );
}

export { BRC20Amount };
