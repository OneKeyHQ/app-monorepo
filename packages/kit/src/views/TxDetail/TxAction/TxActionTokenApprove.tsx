import { useNavigation } from '@react-navigation/core';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useIntl } from 'react-intl';

import { Typography } from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';

import {
  SendRoutes,
  SendRoutesParams,
  TokenApproveAmountEditParams,
} from '../../Send/types';
import { IS_REPLACE_ROUTE_TO_FEE_EDIT } from '../../Send/utils/sendConfirmConsts';
import { TxDetailActionBoxAutoTransform } from '../components/TxDetailActionBoxAutoTransform';
import { TxListActionBox } from '../components/TxListActionBox';
import { TxStatusBarInList } from '../components/TxStatusBar';
import {
  TxActionElementAddressNormal,
  getTxActionElementAddressWithSecurityInfo,
} from '../elements/TxActionElementAddress';
import { TxActionElementAmountNormal } from '../elements/TxActionElementAmount';
import { useTxDetailContext } from '../TxDetailContext';
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
  const { action, decodedTx, meta, network } = props;
  const { accountId, networkId } = decodedTx;
  const navigation = useNavigation<NavigationProps>();
  const intl = useIntl();
  const { amount, symbol } = getTxActionTokenApproveInfo({
    ...props,
    intl,
  });

  const context = useTxDetailContext();
  const isSendConfirm = context?.context?.isSendConfirm;
  const sendConfirmParamsParsed = context?.context?.sendConfirmParamsParsed;

  // TODO sourceInfo get from Tx history
  const sourceInfo = sendConfirmParamsParsed?.sourceInfo;

  const { tokenApprove } = action;
  const amountView = (
    <TxActionElementAmountNormal
      testID="TxActionTokenApprove-AllowanceAmount"
      amount={amount}
      symbol={symbol}
      onPress={
        isSendConfirm
          ? () => {
              const routeName = SendRoutes.TokenApproveAmountEdit;
              if (!sendConfirmParamsParsed?.routeParams) {
                return;
              }
              const routeParams: TokenApproveAmountEditParams = {
                accountId,
                networkId,
                sendConfirmParams: sendConfirmParamsParsed?.routeParams,
                tokenApproveAmount: tokenApprove?.amount ?? '0',
                isMaxAmount: tokenApprove?.isMax ?? true,
                sourceInfo,
                encodedTx: decodedTx.encodedTx,
                decodedTx,
              };
              if (IS_REPLACE_ROUTE_TO_FEE_EDIT) {
                return navigation.replace(routeName, routeParams);
              }
              // TODO history detail view is NOT editable
              return navigation.navigate(routeName, routeParams);
            }
          : undefined
      }
      subText={
        tokenApprove?.isMax ? (
          <Typography.Body2Strong color="text-warning" mt="1">
            {intl.formatMessage({
              id: 'content__unlimited_authorization_puts_all_approved_tokens_at_risk',
            })}
          </Typography.Body2Strong>
        ) : undefined
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
      content: getTxActionElementAddressWithSecurityInfo({
        address: tokenApprove?.spender || '',
        networkId: network?.id,
        withSecurityInfo: true,
      }),
    },
  ].filter(Boolean);

  return (
    <TxDetailActionBoxAutoTransform
      decodedTx={decodedTx}
      iconInfo={meta?.iconInfo}
      titleInfo={meta?.titleInfo}
      // content={<Box mb={4}>{amountView}</Box>}
      details={details}
    />
  );
}

export function TxActionTokenApproveT0(props: ITxActionCardProps) {
  const { meta, decodedTx, historyTx } = props;

  const intl = useIntl();
  const { amount, symbol, spender, displayDecimals } =
    getTxActionTokenApproveInfo({
      ...props,
      intl,
    });
  const statusBar = (
    <TxStatusBarInList decodedTx={decodedTx} historyTx={historyTx} />
  );
  return (
    <TxListActionBox
      symbol={symbol}
      footer={statusBar}
      iconInfo={meta?.iconInfo}
      titleInfo={meta?.titleInfo}
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
