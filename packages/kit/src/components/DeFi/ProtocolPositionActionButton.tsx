import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Button, XStack } from '@onekeyhq/components';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import defiActionUtils from '@onekeyhq/shared/src/utils/defiActionUtils';
import type {
  IDeFiProtocol,
  IDeFiSupportedProtocolAction,
} from '@onekeyhq/shared/types/defi';

import {
  type IProtocolPositionActionSuccessParams,
  getActionLabel,
  showProtocolPositionActionDialog,
} from './ProtocolPositionActionDialog';

type IProtocolPositionActionButtonProps = {
  accountId?: string;
  protocol: Pick<IDeFiProtocol, 'networkId' | 'protocol'>;
  position: IDeFiProtocol['positions'][number];
  supportedActions: IDeFiSupportedProtocolAction[];
  onSuccess?: (
    params: IProtocolPositionActionSuccessParams,
  ) => void | Promise<void>;
};

const ProtocolPositionActionButton = memo(
  ({
    accountId,
    protocol,
    position,
    supportedActions,
    onSuccess,
  }: IProtocolPositionActionButtonProps) => {
    const intl = useIntl();
    const isActionAccount =
      !!accountId &&
      !accountUtils.isWatchingAccount({ accountId }) &&
      !accountUtils.isUrlAccountFn({ accountId });
    const actions = useMemo(
      () =>
        isActionAccount
          ? defiActionUtils.resolveDeFiPositionActions({
              protocol,
              position,
              supportedActions,
            })
          : [],
      [isActionAccount, position, protocol, supportedActions],
    );

    if (!isActionAccount || actions.length === 0) {
      return null;
    }

    return (
      <XStack gap="$1.5" alignItems="center" flexShrink={0}>
        {actions.map((action) => (
          <Button
            key={`${action.action}-${action.assetCategory ?? ''}-${
              action.rewardCategory ?? ''
            }`}
            testID={`defi-position-action-${action.action}`}
            size="small"
            variant="secondary"
            onPress={() =>
              showProtocolPositionActionDialog({
                accountId,
                networkId: protocol.networkId,
                action,
                onSuccess,
              })
            }
          >
            {getActionLabel({ action: action.action, intl })}
          </Button>
        ))}
      </XStack>
    );
  },
);

ProtocolPositionActionButton.displayName = 'ProtocolPositionActionButton';

export { ProtocolPositionActionButton };
