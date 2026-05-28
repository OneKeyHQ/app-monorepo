import { type ComponentProps, memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Button, XStack } from '@onekeyhq/components';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import defiActionUtils from '@onekeyhq/shared/src/utils/defiActionUtils';
import {
  EDeFiPositionAction,
  type IDeFiProtocol,
  type IDeFiSupportedProtocolAction,
} from '@onekeyhq/shared/types/defi';

import {
  type IProtocolPositionActionSuccessParams,
  getActionLabel,
  showProtocolPositionActionDialog,
  useProtocolPositionActionSubmit,
} from './ProtocolPositionActionDialog';

type IProtocolPositionActionButtonProps = {
  accountId?: string;
  protocol: Pick<IDeFiProtocol, 'networkId' | 'protocol'>;
  position: IDeFiProtocol['positions'][number];
  supportedActions: IDeFiSupportedProtocolAction[];
  containerProps?: Omit<ComponentProps<typeof XStack>, 'children'>;
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
    containerProps,
    onSuccess,
  }: IProtocolPositionActionButtonProps) => {
    const intl = useIntl();
    const submitProtocolPositionAction = useProtocolPositionActionSubmit({
      accountId: accountId ?? '',
      networkId: protocol.networkId,
      onSuccess,
    });
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
    const handleActionPress = useCallback(
      async (action: (typeof actions)[number]) => {
        if (!accountId) {
          return;
        }

        const selectedAsset = action.assets[0];
        if (
          selectedAsset &&
          action.assets.length === 1 &&
          action.action !== EDeFiPositionAction.RemoveLiquidity
        ) {
          try {
            await submitProtocolPositionAction({
              action,
              selectedAsset,
            });
          } catch {
            return;
          }
          return;
        }

        showProtocolPositionActionDialog({
          accountId,
          networkId: protocol.networkId,
          action,
          onSuccess,
        });
      },
      [accountId, onSuccess, protocol.networkId, submitProtocolPositionAction],
    );

    if (!isActionAccount || actions.length === 0) {
      return null;
    }

    return (
      <XStack gap="$1.5" alignItems="center" flexShrink={0} {...containerProps}>
        {actions.map((action) => (
          <Button
            key={`${action.action}-${action.assetCategory ?? ''}-${
              action.rewardCategory ?? ''
            }`}
            testID={`defi-position-action-${action.action}`}
            size="small"
            variant="primary"
            onPress={() => void handleActionPress(action)}
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
