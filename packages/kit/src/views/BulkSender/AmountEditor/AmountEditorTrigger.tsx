import { useCallback, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { BulkTypeEnum } from '@onekeyhq/engine/src/types/batchTransfer';
import type { Token } from '@onekeyhq/engine/src/types/token';

import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { TxSettingTrigger } from '../TxSetting/TxSettingTrigger';
import { AmountTypeEnum, BulkSenderRoutes } from '../types';

type Props = {
  token: Token;
  transferCount: number;
  amount: string[];
  amountType: AmountTypeEnum;
  bulkType: BulkTypeEnum;
  handleOnAmountChanged: ({
    amount,
    amountType,
  }: {
    amount: string[];
    amountType: AmountTypeEnum;
  }) => void;
  networkId: string;
  accountAddress: string;
};

function AmountEditorTrigger(props: Props) {
  const {
    networkId,
    amount,
    amountType,
    bulkType,
    token,
    transferCount,
    handleOnAmountChanged,
    accountAddress,
  } = props;
  const intl = useIntl();
  const navigation = useNavigation();

  const { title, desc } = useMemo(() => {
    switch (amountType) {
      case AmountTypeEnum.Fixed:
        return {
          title: `${amount[0]} ${token?.symbol}`,
          desc: `${intl.formatMessage({
            id: 'content__total',
          })}: ${new BigNumber(amount[0] ?? 0)
            .times(transferCount)
            .toFixed()} ${token?.symbol}`,
        };
      case AmountTypeEnum.Random:
        return {
          title: `${amount[0]} ${token?.symbol} ~ ${amount[1]} ${token?.symbol}`,
          desc: `Max Total: ${new BigNumber(amount[1] ?? 0)
            .times(transferCount)
            .toFixed()} ${token?.symbol}`,
        };
      case AmountTypeEnum.All:
        return {
          title: intl.formatMessage({ id: 'option__all' }),
        };

      case AmountTypeEnum.Custom:
        return {
          title: intl.formatMessage({ id: 'title__custom' }),
          desc: 'Set amounts for each accounts',
        };
      default:
        return {
          title: `${amount[0]} ${token?.symbol}`,
          desc: `${intl.formatMessage({
            id: 'content__total',
          })}: ${new BigNumber(amount[0] ?? 0)
            .times(transferCount)
            .toFixed()} ${token?.symbol}`,
        };
    }
  }, [amountType, amount, token?.symbol, intl, transferCount]);

  const handleOpenAmountEditor = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.BulkSender,
      params: {
        screen: BulkSenderRoutes.AmountEditor,
        params: {
          bulkType,
          amount,
          amountType,
          token,
          networkId,
          accountAddress,
          onAmountChanged: handleOnAmountChanged,
        },
      },
    });
  }, [
    accountAddress,
    amount,
    amountType,
    bulkType,
    handleOnAmountChanged,
    navigation,
    networkId,
    token,
  ]);

  return (
    <TxSettingTrigger
      header={intl.formatMessage({ id: 'form__amount_per_transaction' })}
      title={title}
      desc={desc}
      onPress={handleOpenAmountEditor}
    />
  );
}

export { AmountEditorTrigger };
