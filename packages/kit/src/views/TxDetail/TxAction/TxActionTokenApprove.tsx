import React from 'react';

import { useNavigation } from '@react-navigation/core';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useIntl } from 'react-intl';

import { shortenAddress } from '@onekeyhq/components/src/utils';

import { SendRoutes, SendRoutesParams } from '../../Send/types';
import { useSendConfirmRouteParamsParsed } from '../../Send/useSendConfirmRouteParamsParsed';
import { TxDetailActionBox } from '../components/TxDetailActionBox';
import { TxListActionBox } from '../components/TxListActionBox';
import { TxActionElementAddressNormal } from '../elements/TxActionElementAddress';
import { TxActionElementAmountNormal } from '../elements/TxActionElementAmount';
import {
  TxActionElementIconLarge,
  TxActionElementIconNormal,
} from '../elements/TxActionElementIcon';
import {
  TxActionElementTitleHeading,
  TxActionElementTitleNormal,
} from '../elements/TxActionElementTitle';
import {
  ITxActionCardProps,
  ITxActionElementDetail,
  ITxActionMetaIcon,
  ITxActionMetaTitle,
} from '../types';

type NavigationProps = NativeStackNavigationProp<
  SendRoutesParams,
  SendRoutes.TokenApproveAmountEdit
>;

export function getTxActionTokenApproveInfo(props: ITxActionCardProps) {
  const { action, intl, network } = props;
  const { tokenApprove } = action;
  const spender = tokenApprove?.spender || '';
  const amount = tokenApprove?.isMax
    ? intl.formatMessage({ id: 'form__unlimited' })
    : tokenApprove?.amount ?? '0';
  const symbol = tokenApprove?.tokenInfo.symbol ?? '';
  const displayDecimals = network?.tokenDisplayDecimals;

  const titleInfo: ITxActionMetaTitle = {
    titleKey: 'title__approve',
  };
  const iconUrl = action.tokenApprove?.tokenInfo.logoURI;
  let iconInfo: ITxActionMetaIcon | undefined;
  if (iconUrl) {
    iconInfo = {
      icon: {
        url: iconUrl,
      },
    };
  }

  return {
    displayDecimals,
    amount,
    symbol,
    spender,
    titleInfo,
    iconInfo,
  };
}

export function TxActionTokenApprove(props: ITxActionCardProps) {
  const { action, decodedTx, meta } = props;
  const icon = <TxActionElementIconNormal {...meta} />;
  const title = <TxActionElementTitleHeading {...meta} />;
  const navigation = useNavigation<NavigationProps>();
  const intl = useIntl();
  const { amount, symbol } = getTxActionTokenApproveInfo({
    ...props,
    intl,
  });

  // TODO sourceInfo get from Tx history
  const sendConfirmParams = useSendConfirmRouteParamsParsed();
  const isSendConfirm = Boolean(sendConfirmParams.encodedTx);
  const { sourceInfo } = sendConfirmParams;

  const { tokenApprove } = action;
  const amountView = (
    <TxActionElementAmountNormal
      amount={amount}
      symbol={symbol}
      onPress={
        isSendConfirm
          ? () => {
              // TODO history detail view is NOT editable
              navigation.navigate(SendRoutes.TokenApproveAmountEdit, {
                tokenApproveAmount: tokenApprove?.amount ?? '0',
                isMaxAmount: tokenApprove?.isMax ?? true,
                sourceInfo,
                encodedTx: decodedTx.encodedTx,
                decodedTx,
              });
            }
          : undefined
      }
    />
  );

  const details: ITxActionElementDetail[] = [
    {
      title: intl.formatMessage({ id: 'content__spend_limit_amount' }),
      content: amountView,
    },
    {
      title: intl.formatMessage({ id: 'content__token_approve_owner' }),
      content: (
        <TxActionElementAddressNormal address={tokenApprove?.owner ?? ''} />
      ),
    },
    {
      title: intl.formatMessage({ id: 'content__token_approve_spender' }),
      content: (
        <TxActionElementAddressNormal address={tokenApprove?.spender ?? ''} />
      ),
    },
  ].filter(Boolean);
  if (sourceInfo?.origin) {
    details.push({
      title: intl.formatMessage({ id: 'content__interact_with' }),
      content: sourceInfo?.origin ?? '-',
    });
  }

  return (
    <TxDetailActionBox
      icon={icon}
      title={title}
      // content={<Box mb={4}>{amountView}</Box>}
      details={details}
    />
  );
}

export function TxActionTokenApproveT0(props: ITxActionCardProps) {
  const { meta, decodedTx, historyTx } = props;
  const icon = <TxActionElementIconLarge {...meta} />;
  const title = <TxActionElementTitleNormal {...meta} />;

  const intl = useIntl();
  const { amount, symbol, spender, displayDecimals } =
    getTxActionTokenApproveInfo({
      ...props,
      intl,
    });

  return (
    <TxListActionBox
      historyTx={historyTx}
      decodedTx={decodedTx}
      icon={icon}
      title={title}
      subTitle={shortenAddress(spender)}
      content={
        <TxActionElementAmountNormal
          textAlign="right"
          justifyContent="flex-end"
          amount={amount}
          symbol={symbol}
          decimals={displayDecimals}
          direction={undefined}
        />
      }
    />
  );
}
