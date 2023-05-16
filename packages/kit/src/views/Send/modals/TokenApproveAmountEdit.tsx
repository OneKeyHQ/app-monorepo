import { useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Form, useForm } from '@onekeyhq/components';
import { InfiniteAmountText } from '@onekeyhq/engine/src/vaults/impl/evm/decoder/decoder';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveSideAccount } from '../../../hooks';
import { useFormOnChangeDebounced } from '../../../hooks/useFormOnChangeDebounced';
import { BaseSendModal } from '../components/BaseSendModal';
import { SendModalRoutes } from '../types';
import { IS_REPLACE_ROUTE_TO_FEE_EDIT } from '../utils/sendConfirmConsts';

import type { SendRoutesParams } from '../types';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RouteProps = RouteProp<
  SendRoutesParams,
  SendModalRoutes.TokenApproveAmountEdit
>;

type FeeValues = {
  amount: string;
};

type NavigationProps = NativeStackNavigationProp<
  SendRoutesParams,
  SendModalRoutes.TokenApproveAmountEdit
>;

function TokenApproveAmountEdit({ ...rest }) {
  const { trigger } = rest;
  const { engine } = backgroundApiProxy;
  const intl = useIntl();
  // const isSmallScreen = useIsVerticalLayout();
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<RouteProps>();
  const { encodedTx, tokenApproveAmount, isMaxAmount } = route.params;
  const { networkId, accountId, network } = useActiveSideAccount(route.params);
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
    const prevRouteName =
      routes[index - 1]?.name || SendModalRoutes.SendConfirm;
    const prevRouteParams = {
      ...sendConfirmParams,
      networkId,
      accountId,
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
    <BaseSendModal
      accountId={accountId}
      networkId={networkId}
      trigger={trigger}
      primaryActionTranslationId="action__save"
      onPrimaryActionPress={() => onSubmit()}
      primaryActionProps={{
        isDisabled: !isValid,
      }}
      hideSecondaryAction
      onModalClose={() => {
        sendConfirmParams?.onModalClose?.();
      }}
      secondaryActionTranslationId="action__reject"
      header={intl.formatMessage({ id: 'content__spend_limit_amount' })}
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
                maxButtonTranslationId="form__unlimited"
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
