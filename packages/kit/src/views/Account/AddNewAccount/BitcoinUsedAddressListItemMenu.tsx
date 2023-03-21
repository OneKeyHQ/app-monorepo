import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Divider, ToastManager } from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import type { BtcForkChainUsedAccount } from '@onekeyhq/engine/src/types/account';
import type { Network } from '@onekeyhq/engine/src/types/network';
import BaseMenu from '@onekeyhq/kit/src/views/Overlay/BaseMenu';
import type {
  IBaseMenuOptions,
  IMenu,
} from '@onekeyhq/kit/src/views/Overlay/BaseMenu';

import useOpenBlockBrowser from '../../../hooks/useOpenBlockBrowser';

const BitcoinUsedAddressListItemMenu: FC<
  IMenu & {
    item: BtcForkChainUsedAccount & { suffixPath?: string };
    network: Network;
    showRemoveOption: boolean;
    onRemoveAddress?: (
      item: BtcForkChainUsedAccount & { suffixPath?: string },
    ) => void;
  }
> = ({ item, network, showRemoveOption, onRemoveAddress, ...props }) => {
  const intl = useIntl();
  const { openAddressDetails } = useOpenBlockBrowser(network);
  const onOpenBlockChainBrowser = useCallback(() => {
    openAddressDetails(item.name);
  }, [item, openAddressDetails]);

  const onPressCopyAddress = useCallback(() => {
    setTimeout(() => {
      copyToClipboard(item.name);
      ToastManager.show({
        title: intl.formatMessage({ id: 'msg__address_copied' }),
      });
    }, 200);
  }, [item, intl]);

  const options = useMemo<IBaseMenuOptions>(
    () => [
      {
        id: 'action__copy_address',
        onPress: onPressCopyAddress,
        icon: 'Square2StackOutline',
      },
      {
        id: 'action__open_blockchain_browser',
        onPress: onOpenBlockChainBrowser,
        icon: 'GlobeAltOutline',
      },
      showRemoveOption && (() => <Divider my={1} />),
      showRemoveOption && {
        id: 'action__remove_address',
        onPress: () => onRemoveAddress?.(item),
        icon: 'TrashOutline',
        variant: 'desctructive',
      },
    ],
    [
      onPressCopyAddress,
      onOpenBlockChainBrowser,
      onRemoveAddress,
      showRemoveOption,
      item,
    ],
  );

  return <BaseMenu options={options} {...props} menuWidth={310} />;
};

export default BitcoinUsedAddressListItemMenu;
