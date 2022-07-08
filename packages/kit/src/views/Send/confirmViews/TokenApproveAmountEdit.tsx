import React, { useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Form, Modal, useForm } from '@onekeyhq/components';
import { InfiniteAmountText } from '@onekeyhq/engine/src/vaults/impl/evm/decoder/decoder';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../../hooks';
import { useFormOnChangeDebounced } from '../../../hooks/useFormOnChangeDebounced';
import { IS_REPLACE_ROUTE_TO_FEE_EDIT } from '../sendConfirmConsts';
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
  // const isSmallScreen = useIsVerticalLayout();
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<RouteProps>();
  const { networkId, accountId, network } = useActiveWalletAccount();
  const { encodedTx, tokenApproveAmount, isMaxAmount } = route.params;
  const [isMax, setIsMax] = useState(isMaxAmount);
  const { decodedTx, sendConfirmParams } = route.params;
  const info = decodedTx?.actions?.[0]?.tokenApprove;
  const token = info?.tokenInfo;
  const symbol = token?.symbol;

  const useFormReturn = useForm<FeeValues>({
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      amount: isMaxAmount ? '' : tokenApproveAmount,
    },
  });
  const { control, handleSubmit, trigger: formTrigger } = useFormReturn;
  const { isValid } = useFormOnChangeDebounced({
    useFormReturn,
  });
  const onSubmit = handleSubmit(async (data) => {
    if (!navigation.canGoBack()) {
      return;
    }
    if (!encodedTx) {
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
    const prevRouteParams = {
      ...sendConfirmParams,
      tokenApproveAmount: amount,
      encodedTx: tx,
    };
    if (IS_REPLACE_ROUTE_TO_FEE_EDIT) {
      return navigation.replace(prevRouteName, prevRouteParams);
    }
    return navigation.navigate({
      merge: true,
      name: prevRouteName,
      params: prevRouteParams,
    });
  });

  const validateRules = {
    required: intl.formatMessage({ id: 'form__max_spend_limit_validateRules' }),
  };
  if (isMax) {
    validateRules.required = '';
  }

  return (
    <Modal
      trigger={trigger}
      primaryActionTranslationId="action__save"
      onPrimaryActionPress={() => onSubmit()}
      primaryActionProps={{
        isDisabled: !isValid,
      }}
      hideSecondaryAction
      secondaryActionTranslationId="action__reject"
      header={intl.formatMessage({ id: 'content__spend_limit_amount' })}
      headerDescription={network?.name || network?.shortName || undefined}
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
                {
                  0:
                    route.params.sourceInfo?.origin ??
                    network?.shortName ??
                    '--',
                },
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
                maxModeCanEdit
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
