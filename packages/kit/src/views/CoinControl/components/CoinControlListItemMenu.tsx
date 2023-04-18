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
    item: ICoinControlListItem;
    network: Network;
  }
> = ({ item, network, ...props }) => {
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
        console.log(label);
      },
    });
  }, [item.label]);

  const options = useMemo<IBaseMenuOptions>(
    () => [
      {
        id: hasLabel ? 'action__edit_label' : 'action__add_label',
        onPress: onPressEditLabel,
        icon: 'Square2StackOutline',
      },
      hasLabel && {
        id: 'action__delete_label',
        onPress: () => {},
        icon: 'TrashOutline',
      },
      () => <Divider my={1} />,
      {
        id: 'action__view_in_browser',
        onPress: onOpenBlockChainBrowser,
        icon: 'GlobeAltOutline',
      },
      () => <Divider my={1} />,
      !isFrozen && {
        id: 'action__freeze',
        onPress: onOpenBlockChainBrowser,
        icon: 'SnowFlakeMini',
      },
      isFrozen && {
        id: 'action__unfreeze',
        onPress: onOpenBlockChainBrowser,
        icon: 'SnowFlakeMini',
      },
    ],
    [onOpenBlockChainBrowser, hasLabel, isFrozen],
  );

  console.log('options ====> :', options);

  return <BaseMenu options={options} {...props} />;
};

export { CoinControlListItemMenu };
