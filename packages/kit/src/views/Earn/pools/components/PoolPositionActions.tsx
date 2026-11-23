import { Page, useScrollContentTabBarOffset } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETabEarnRoutes } from '@onekeyhq/shared/src/routes';
import { EPoolPositionStatus } from '@onekeyhq/shared/types/pools';
import type { IPoolPositionView } from '@onekeyhq/shared/types/pools';

import { POOLS_COPY } from '../poolsCopy';

export type IPoolPositionAction = {
  label: string;
  onPress: () => void;
  primary: boolean;
  testID: string;
};

/**
 * Remove and Add for one position, on its page. Remove while it is open,
 * Add always (a pool off the list asks for the risk at review). No position,
 * no actions.
 */
export function usePoolPositionActions(
  view: IPoolPositionView | undefined,
  testIDPrefix: string,
): IPoolPositionAction[] {
  const navigation = useAppNavigation();
  if (!view) {
    return [];
  }
  const { pool, position } = view;
  const canRemove = view.status !== EPoolPositionStatus.Closed;
  const actions: IPoolPositionAction[] = [];
  if (canRemove) {
    actions.push({
      label: POOLS_COPY.remove,
      onPress: () =>
        navigation.push(ETabEarnRoutes.EarnPoolRemoveLiquidity, {
          positionId: position.id,
        }),
      primary: false,
      testID: `${testIDPrefix}-remove`,
    });
  }
  actions.push({
    label: POOLS_COPY.add,
    onPress: () =>
      navigation.push(ETabEarnRoutes.EarnPoolAddLiquidity, {
        poolId: pool.id,
        positionId: position.id,
      }),
    primary: true,
    testID: `${testIDPrefix}-add`,
  });
  return actions;
}

/** The phone footer for a position's actions: the main one on the right */
export function PoolPositionActionsFooter({
  actions,
}: {
  actions: IPoolPositionAction[];
}) {
  const tabBarHeight = useScrollContentTabBarOffset();
  const primaryAction = actions.find((action) => action.primary);
  const secondaryAction = actions.find((action) => !action.primary);
  if (!primaryAction) {
    return null;
  }
  return (
    <Page.Footer
      onConfirmText={primaryAction.label}
      confirmButtonProps={{
        variant: 'primary',
        onPress: primaryAction.onPress,
        testID: primaryAction.testID,
        // Both buttons carry the offset, as on the protocol page; one alone
        // stretches the other to the row's height
        mb: tabBarHeight,
      }}
      {...(secondaryAction
        ? {
            onCancelText: secondaryAction.label,
            cancelButtonProps: {
              onPress: secondaryAction.onPress,
              testID: secondaryAction.testID,
              mb: tabBarHeight,
            },
          }
        : {})}
    />
  );
}
