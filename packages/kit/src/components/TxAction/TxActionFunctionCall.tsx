import { useIntl } from 'react-intl';

import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import {
  TxActionCommonDetailView,
  TxActionCommonListView,
} from './TxActionCommon';

import type { ITxActionCommonProps, ITxActionProps } from './types';

function getTxActionFunctionCallInfo(props: ITxActionProps) {
  const { action } = props;
  const { functionCall } = action;
  const target = functionCall?.target ?? '';
  const functionName = functionCall?.functionName ?? '';
  const functionHash = functionCall?.functionHash ?? '';
  const functionSignature = functionCall?.functionSignature ?? '';
  const args = functionCall?.args ?? [];

  return {
    target,
    functionName,
    functionHash,
    functionSignature,
    args,
  };
}

function TxActionFunctionCallListView(props: ITxActionProps) {
  const intl = useIntl();
  const { target, functionName } = getTxActionFunctionCallInfo(props);

  const title = functionName;
  const avatar: ITxActionCommonProps['avatar'] = {
    circular: true,
    fallbackIcon: 'ImageMountainSolid',
  };
  const description = {
    prefix: intl.formatMessage({ id: 'content__to' }),
    children: accountUtils.shortenAddress({ address: target }),
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
  const { target, functionName } = getTxActionFunctionCallInfo(props);

  const title = intl.formatMessage({ id: 'transaction__contract_interaction' });
  const content = functionName;
  const description = `To: ${target}`;

  return (
    <TxActionCommonDetailView
      title={title}
      content={content}
      description={description}
    />
  );
}

export { TxActionFunctionCallListView, TxActionFunctionCallDetailView };
