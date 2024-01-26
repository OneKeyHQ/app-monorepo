import { useIntl } from 'react-intl';

import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import {
  TxActionCommonDetailView,
  TxActionCommonListView,
} from './TxActionCommon';

import type { ITxActionCommonListViewProps, ITxActionProps } from './types';

function getTxActionFunctionCallInfo(props: ITxActionProps) {
  const { action } = props;
  const { functionCall } = action;
  const functionFrom = functionCall?.from ?? '';
  const functionTo = functionCall?.to ?? '';
  const functionName = functionCall?.functionName ?? '';
  const functionHash = functionCall?.functionHash ?? '';
  const functionSignature = functionCall?.functionSignature ?? '';
  const functionIcon = functionCall?.icon ?? '';
  const args = functionCall?.args ?? [];

  return {
    functionFrom,
    functionTo,
    functionIcon,
    functionName,
    functionHash,
    functionSignature,
    args,
  };
}

function TxActionFunctionCallListView(props: ITxActionProps) {
  const intl = useIntl();
  const { functionTo, functionName, functionIcon } =
    getTxActionFunctionCallInfo(props);

  const title = functionName;
  const avatar: ITxActionCommonListViewProps['avatar'] = {
    circular: true,
    src: functionIcon,
    fallbackIcon: 'ImageMountainSolid',
  };
  const description = {
    prefix: intl.formatMessage({ id: 'content__to' }),
    children: accountUtils.shortenAddress({ address: functionTo }),
  };

  return (
    <TxActionCommonListView
      title={title}
      avatar={avatar}
      description={description}
    />
  );
}

function TxActionFunctionCallDetailView(props: ITxActionProps) {
  const intl = useIntl();
  const { functionFrom, functionTo, functionName, functionIcon } =
    getTxActionFunctionCallInfo(props);

  return (
    <TxActionCommonDetailView
      overview={{
        title: intl.formatMessage({ id: 'transaction__contract_interaction' }),
        content: functionName,
        avatar: {
          src: functionIcon,
          circular: true,
        },
      }}
      target={{ title: 'To Contract', content: functionTo }}
      source={{ content: functionFrom }}
    />
  );
}

export { TxActionFunctionCallListView, TxActionFunctionCallDetailView };
