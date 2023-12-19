import { useIntl } from 'react-intl';

import { Icon, ListItem } from '@onekeyhq/components';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import type { ITxActionProps } from './types';

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

function TxActionFunctionCallT0(props: ITxActionProps) {
  const intl = useIntl();
  const { target, functionName } = getTxActionFunctionCallInfo(props);

  const title = intl.formatMessage({ id: 'transaction__contract_interaction' });
  const subTitle = `to: ${accountUtils.shortenAddress({ address: target })}`;

  return (
    <ListItem
      title={title}
      subtitle={subTitle}
      avatarProps={{
        fallbackProps: {
          bg: '$bgStrong',
          justifyContent: 'center',
          alignItems: 'center',
          children: <Icon name="ImageMountainSolid" />,
        },
      }}
    >
      <ListItem.Text primary={functionName} />
    </ListItem>
  );
}

function TxActionFunctionCallT1() {
  return null;
}

export { TxActionFunctionCallT0, TxActionFunctionCallT1 };
