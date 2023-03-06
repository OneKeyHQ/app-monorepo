import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useAccountSimple, useNavigationActions } from '../../../../hooks';
import { useClipboard } from '../../../../hooks/useClipboard';
import { useNetwork } from '../../../../hooks/useNetwork';
import useOpenBlockBrowser from '../../../../hooks/useOpenBlockBrowser';
import BaseMenu from '../../../Overlay/BaseMenu';

import type { IBaseMenuOptions, IMenu } from '../../../Overlay/BaseMenu';
import type { TransactionDetails } from '../../typings';

type Props = {
  tx: TransactionDetails;
};

export const ReceiptMoreMenus: FC<IMenu & Props> = ({ tx, ...rest }) => {
  const { networkId, receivingAccountId, receivingAddress, tokens } = tx;
  const toNetworkId = tokens?.to.networkId;
  const { copyText } = useClipboard();
  const { network } = useNetwork({ networkId });
  const account = useAccountSimple(receivingAccountId ?? null);
  const openBlockBrowser = useOpenBlockBrowser(network);
  const { openRootHome } = useNavigationActions();

  const onOpenAccount = useCallback(() => {
    if (account) {
      backgroundApiProxy.serviceAccount.changeActiveAccountByAddress({
        address: account?.address,
        networkId: toNetworkId,
      });
      openRootHome();
    }
  }, [openRootHome, account, toNetworkId]);

  const options = useMemo(() => {
    const baseOptions: IBaseMenuOptions = [
      Boolean(account) && {
        id: 'action__view_account',
        onPress: () => onOpenAccount(),
        icon: 'UserOutline',
      },
      Boolean(receivingAddress) && {
        id: 'action__copy_address',
        onPress: () => copyText(receivingAddress ?? ''),
        icon: 'Square2StackOutline',
      },
      openBlockBrowser.hasAvailable && {
        id: 'action__view_in_browser',
        onPress: () => openBlockBrowser.openAddressDetails(account?.address),
        icon: 'ArrowTopRightOnSquareOutline',
      },
    ];
    return baseOptions;
  }, [copyText, openBlockBrowser, onOpenAccount, receivingAddress, account]);

  return <BaseMenu options={options} {...rest} />;
};
