import { isString } from 'lodash';

import type { ICON_NAMES } from '@onekeyhq/components';
import type { ThemeValues } from '@onekeyhq/components/src/Provider/theme';
import type { IDecodedTx } from '@onekeyhq/engine/src/vaults/types';
import { IDecodedTxStatus } from '@onekeyhq/engine/src/vaults/types';

export function fallbackTextComponent(
  target: JSX.Element | string | undefined,
  ComponentClass: any,
): JSX.Element | undefined {
  if (!target) {
    return undefined;
  }
  if (isString(target)) {
    return <ComponentClass>{target}</ComponentClass>;
  }
  return target;
}

export function getTxStatusInfo({ decodedTx }: { decodedTx: IDecodedTx }) {
  const { status } = decodedTx;
  // default icon and title is `failed`
  let text:
    | 'transaction__failed'
    | 'transaction__pending'
    | 'transaction__dropped'
    | 'transaction__success' = 'transaction__failed';
  let textColor = 'text-critical';

  // TxStatusFailureCircleIllus XCircleOutline
  let iconName: ICON_NAMES = 'TxStatusFailureCircleIllus';
  let iconColor: keyof ThemeValues = 'icon-critical';
  let iconContainerColor = 'surface-critical-default';

  switch (status) {
    case IDecodedTxStatus.Pending:
      text = 'transaction__pending';
      // TxStatusWarningCircleIllus DotsCircleHorizontalOutline
      iconName = 'TxStatusWarningCircleIllus';
      iconColor = 'icon-warning';
      textColor = 'text-warning';
      iconContainerColor = 'surface-warning-default';
      break;
    case IDecodedTxStatus.Confirmed:
      text = 'transaction__success';
      // TxStatusSuccessCircleIllus CheckCircleOutline
      iconName = 'TxStatusSuccessCircleIllus';
      iconColor = 'icon-success';
      textColor = 'text-success';
      iconContainerColor = 'surface-success-default';
      break;
    case IDecodedTxStatus.Dropped:
      text = 'transaction__dropped';
      break;
    default:
      break;
  }
  return {
    text,
    textColor,
    iconName,
    iconColor,
    iconContainerColor,
  };
}

export function getDisplayedActions({ decodedTx }: { decodedTx: IDecodedTx }) {
  const { outputActions, actions } = decodedTx;
  return (
    (outputActions && outputActions.length ? outputActions : actions) || []
  );
}
