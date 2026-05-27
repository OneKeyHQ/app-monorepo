import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Button, XStack } from '@onekeyhq/components';
import defiActionUtils from '@onekeyhq/shared/src/utils/defiActionUtils';
import type {
  IDeFiProtocol,
  IDeFiSupportedProtocolAction,
} from '@onekeyhq/shared/types/defi';

import {
  getActionLabel,
  showProtocolPositionActionDialog,
} from './ProtocolPositionActionDialog';

type IProtocolPositionActionButtonProps = {
  accountId?: string;
  protocol: Pick<IDeFiProtocol, 'networkId' | 'protocol'>;
  position: IDeFiProtocol['positions'][number];
  supportedActions: IDeFiSupportedProtocolAction[];
  onSuccess?: () => void | Promise<void>;
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
    const actions = useMemo(
      () =>
        accountId
          ? defiActionUtils.resolveDeFiPositionActions({
              protocol,
              position,
              supportedActions,
            })
          : [],
      [accountId, position, protocol, supportedActions],
    );

    if (!accountId || actions.length === 0) {
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
