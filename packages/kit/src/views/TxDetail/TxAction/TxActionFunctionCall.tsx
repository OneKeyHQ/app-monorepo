import { useIntl } from 'react-intl';

import { Box, Text } from '@onekeyhq/components';
import { IDecodedTxActionType } from '@onekeyhq/engine/src/vaults/types';

import { TxDetailActionBoxAutoTransform } from '../components/TxDetailActionBoxAutoTransform';
import { TxListActionBox } from '../components/TxListActionBox';
import { TxStatusBarInList } from '../components/TxStatusBar';
import { TxActionElementAddressNormal } from '../elements/TxActionElementAddress';

import type {
  ITxActionCardProps,
  ITxActionElementDetail,
  ITxActionMetaTitle,
} from '../types';

export function getTxActionFunctionCallInfo(props: ITxActionCardProps) {
  const { action } = props;

  let target = '';
  let functionName = '';
  let functionHash = '';
  let functionSignature = '';
  let args: any[] = [];
  if (action.type === IDecodedTxActionType.FUNCTION_CALL) {
    target = action.functionCall?.target ?? '';
    functionName = action.functionCall?.functionName ?? '';
    functionHash = action.functionCall?.functionHash ?? '';
    functionSignature = action.functionCall?.functionSignature ?? '';
    args = action.functionCall?.args ?? [];
  }

  const titleInfo: ITxActionMetaTitle = {
    titleKey: 'form__contract_data',
  };

  return {
    titleInfo,
    target,
    functionName,
    functionHash,
    functionSignature,
    args,
  };
}

function secureFetchArg(arg: any) {
  try {
    return JSON.stringify(arg);
  } catch (error) {
    return 'unknown data';
  }
}

export function TxActionFunctionCall(props: ITxActionCardProps) {
  const { meta, decodedTx } = props;
  const intl = useIntl();

  const { target, args, functionName } = getTxActionFunctionCallInfo(props);

  const details: ITxActionElementDetail[] = [
    {
      title: intl.formatMessage({ id: 'content__token_approve_owner' }),
      content: (
        <TxActionElementAddressNormal isShorten={false} address={target} />
      ),
    },
    {
      title: intl.formatMessage({ id: 'form__contract' }),
      content: (
        <Text
          typography={{ sm: 'Caption', md: 'Caption' }}
          flex={1}
          overflowWrap="anywhere"
        >
          {functionName}
        </Text>
      ),
    },
    {
      title: intl.formatMessage({ id: 'form__contract_data' }),
      content: (
        <Box>
          {args.map((arg) => (
            <Text
              typography={{ sm: 'Caption', md: 'Caption' }}
              color="text-subdued"
              flex={1}
              overflowWrap="anywhere"
            >
              {secureFetchArg(arg)}
            </Text>
          ))}
        </Box>
      ),
    },
  ];

  return (
    <TxDetailActionBoxAutoTransform
      decodedTx={decodedTx}
      iconInfo={meta?.iconInfo}
      titleInfo={meta?.titleInfo}
      details={details}
    />
  );
}

export function TxActionFunctionCallT0(props: ITxActionCardProps) {
  const { meta, decodedTx, historyTx } = props;
  const intl = useIntl();
  const { target, functionName } = getTxActionFunctionCallInfo(props);
  const statusBar = (
    <TxStatusBarInList decodedTx={decodedTx} historyTx={historyTx} />
  );
  return (
    <TxListActionBox
      footer={statusBar}
      iconInfo={meta?.iconInfo}
      titleInfo={meta?.titleInfo}
      content={
        <TxActionElementAddressNormal
          isShorten={false}
          address={target}
          isCopy={false}
        />
      }
      subTitle={intl.formatMessage({ id: 'form__contract' })}
      extra={
        <TxActionElementAddressNormal
          isShorten={false}
          address={functionName}
          isCopy={false}
        />
      }
    />
  );
}
