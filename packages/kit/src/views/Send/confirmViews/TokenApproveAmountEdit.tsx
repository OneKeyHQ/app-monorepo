import React, { useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Column, Row } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  Form,
  Modal,
  useForm,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import {
  EVMDecodedItem,
  EVMDecodedItemERC20Approve,
  InfiniteAmountText,
} from '@onekeyhq/engine/src/vaults/impl/evm/decoder/decoder';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../../hooks/redux';
import { SendRoutes, SendRoutesParams } from '../types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RouteProps = RouteProp<
  SendRoutesParams,
  SendRoutes.TokenApproveAmountEdit
>;

type FeeValues = {
  amount: string;
};

type NavigationProps = NativeStackNavigationProp<
  SendRoutesParams,
  SendRoutes.TokenApproveAmountEdit
>;

function TokenApproveAmountEdit({ ...rest }) {
  const { trigger } = rest;
  const { engine } = backgroundApiProxy;
  const intl = useIntl();
  const isSmallScreen = useIsVerticalLayout();
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<RouteProps>();
  const { networkId, accountId } = useActiveWalletAccount();
  const { encodedTx, tokenApproveAmount, isMaxAmount } = route.params;
  const [isMax, setIsMax] = useState(isMaxAmount);
  const decodedTx = route.params.decodedTx as EVMDecodedItem | null;
  const info = decodedTx?.info as EVMDecodedItemERC20Approve | null;
  const token = info?.token;
  const symbol = token?.symbol;

  const {
    control,
    handleSubmit,
    trigger: formTrigger,
  } = useForm<FeeValues>({
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      amount: isMaxAmount ? '' : tokenApproveAmount,
    },
  });
  const onSubmit = handleSubmit(async (data) => {
    if (!navigation.canGoBack()) {
      return;
    }
    const amount = isMax ? InfiniteAmountText : data.amount;
    const tx = await engine.updateEncodedTxTokenApprove({
      networkId,
      accountId,
      encodedTx,
      amount,
    });

    const { routes, index } = navigation.getState();
    const prevRouteName = routes[index - 1].name;
    navigation.navigate({
      merge: true,
      name: prevRouteName,
      params: {
        tokenApproveAmount: amount,
        encodedTx: tx,
      },
    });
  });

  const { bottom } = useSafeAreaInsets();
  const footer = (
    <Column>
      <Divider />
      <Row
        justifyContent="flex-end"
        alignItems="center"
        px={{ base: 4, md: 6 }}
        pt={4}
        pb={4 + bottom}
      >
        <Button
          flexGrow={isSmallScreen ? 1 : 0}
          type="primary"
          size={isSmallScreen ? 'lg' : 'base'}
          isDisabled={false}
          onPress={onSubmit}
        >
          {intl.formatMessage({ id: 'action__save' })}
        </Button>
      </Row>
    </Column>
  );

  const validateRules = {
    required: intl.formatMessage({ id: 'form__max_spend_limit_validateRules' }),
  };
  if (isMax) {
    validateRules.required = '';
  }

  return (
    <Modal
      trigger={trigger}
      primaryActionTranslationId="action__confirm"
      secondaryActionTranslationId="action__reject"
      header={intl.formatMessage({ id: 'content__spend_limit_amount' })}
      footer={footer}
      scrollViewProps={{
        children: (
          <Form>
            <Form.Item
              label={intl.formatMessage({
                id: 'form__max_spend_limit',
              })}
              rules={validateRules}
              control={control}
              name="amount"
              defaultValue={intl.formatMessage({ id: 'form__unlimited' })}
              helpText={intl.formatMessage(
                {
                  id: 'content__if_you_choose_max',
                },
                { 0: route.params.sourceInfo?.origin ?? '--' },
              )}
            >
              <Form.NumberInput
                w="full"
                size="xl"
                // size={isSmallScreen ? 'xl' : undefined}
                decimal={token?.decimals}
                rightText={symbol}
                enableMaxButton
                isMax={isMax}
                onMaxChange={(v) => {
                  setIsMax(v);
                  if (v) {
                    setTimeout(() => {
                      formTrigger('amount');
                    }, 300);
                  }
                }}
                maxText={intl.formatMessage({ id: 'form__unlimited' })}
              />
            </Form.Item>
          </Form>
        ),
      }}
    />
  );
}

export { TokenApproveAmountEdit };
