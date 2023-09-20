import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import { Divider } from '@onekeyhq/components';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { ICoinControlListItem } from '@onekeyhq/engine/src/types/utxoAccounts';
import BaseMenu from '@onekeyhq/kit/src/views/Overlay/BaseMenu';
import type {
  IBaseMenuOptions,
  IMenu,
} from '@onekeyhq/kit/src/views/Overlay/BaseMenu';

import useOpenBlockBrowser from '../../../hooks/useOpenBlockBrowser';

import { showEditLabelDialog } from './EditLabelDialog';

const CoinControlListItemMenu: FC<
  IMenu & {
    network: Network;
    item: ICoinControlListItem;
    showFrozenOption: boolean;
    showRecycleOption: boolean;
    onConfirmEditLabel: (item: ICoinControlListItem, label: string) => void;
    onFrozenUTXO: (item: ICoinControlListItem, value: boolean) => void;
    onRecycleUTXO: (item: ICoinControlListItem) => void;
  }
> = ({
  item,
  showFrozenOption = true,
  showRecycleOption,
  network,
  onConfirmEditLabel,
  onFrozenUTXO,
  onRecycleUTXO,
  ...props
}) => {
  const { openTransactionDetails } = useOpenBlockBrowser(network);
  const onOpenBlockChainBrowser = useCallback(() => {
    openTransactionDetails(item.txid);
  }, [item, openTransactionDetails]);

  const hasLabel = useMemo(
    () => !!(item.label && item.label.length > 0),
    [item.label],
  );

  const isFrozen = useMemo(() => item.frozen, [item.frozen]);

  const onPressEditLabel = useCallback(() => {
    showEditLabelDialog({
      defaultLabel: item.label ?? '',
      onConfirm: (label) => {
        onConfirmEditLabel(item, label);
      },
    });
  }, [item, onConfirmEditLabel]);

  const onPressDeleteLabel = useCallback(() => {
    onConfirmEditLabel(item, '');
  }, [item, onConfirmEditLabel]);

  const onPressFrozenUTXO = useCallback(() => {
    onFrozenUTXO(item, !isFrozen);
  }, [item, onFrozenUTXO, isFrozen]);

  const onPressRecycleUTXO = useCallback(() => {
    onRecycleUTXO(item);
  }, [item, onRecycleUTXO]);

  const options = useMemo<IBaseMenuOptions>(
    () => [
      {
        id: hasLabel ? 'action__edit_label' : 'action__add_label',
        onPress: onPressEditLabel,
        icon: 'Square2StackOutline',
      },
      hasLabel && {
        id: 'action__delete_label',
        onPress: onPressDeleteLabel,
        icon: 'TrashOutline',
      },
      () => <Divider my={1} />,
      {
        id: 'action__view_in_browser',
        onPress: onOpenBlockChainBrowser,
        icon: 'GlobeAltOutline',
      },
      item.recycle && showRecycleOption && (() => <Divider my={1} />),
      item.recycle &&
        showRecycleOption && {
          id: 'action__restore_to_inscription',
          onPress: onPressRecycleUTXO,
          icon: 'RestoreOutline',
        },
      showFrozenOption && (() => <Divider my={1} />),
      showFrozenOption && {
        id: isFrozen ? 'action__unfreeze' : 'action__freeze',
        onPress: onPressFrozenUTXO,
        icon: 'SnowFlakeMini',
      },
    ],
    [
      hasLabel,
      onPressEditLabel,
      onPressDeleteLabel,
      onOpenBlockChainBrowser,
      item.recycle,
      showRecycleOption,
      onPressRecycleUTXO,
      showFrozenOption,
      isFrozen,
      onPressFrozenUTXO,
    ],
  );

  return <BaseMenu options={options} {...props} />;
};

export { CoinControlListItemMenu };
