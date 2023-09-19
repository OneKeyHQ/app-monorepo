import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ToastManager } from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import type { Network } from '@onekeyhq/engine/src/types/network';
import BaseMenu from '@onekeyhq/kit/src/views/Overlay/BaseMenu';
import type {
  IBaseMenuOptions,
  IMenu,
} from '@onekeyhq/kit/src/views/Overlay/BaseMenu';

import useOpenBlockBrowser from '../../../hooks/useOpenBlockBrowser';

import type { RecoverAccountType } from './RecoverAccounts';

const RecoverAccountListItemMenu: FC<
  IMenu & { item: RecoverAccountType; network: Network }
> = ({ item, network, ...props }) => {
  const intl = useIntl();
  const { openAddressDetails } = useOpenBlockBrowser(network);
  const onOpenBlockChainBrowser = useCallback(() => {
    openAddressDetails(item.displayAddress);
  }, [item, openAddressDetails]);

  const onPressCopyAddress = useCallback(() => {
    setTimeout(() => {
      copyToClipboard(item.displayAddress);
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
        id: 'action__view_in_browser',
        onPress: onOpenBlockChainBrowser,
        icon: 'GlobeAltOutline',
      },
    ],
    [onPressCopyAddress, onOpenBlockChainBrowser],
  );

  return <BaseMenu options={options} {...props} />;
};

export default RecoverAccountListItemMenu;
