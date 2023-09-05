import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useAccount, useNavigationActions } from '../../../../hooks';
import { useClipboard } from '../../../../hooks/useClipboard';
import { useNetwork } from '../../../../hooks/useNetwork';
import useOpenBlockBrowser from '../../../../hooks/useOpenBlockBrowser';
import BaseMenu from '../../../Overlay/BaseMenu';

import type { IBaseMenuOptions, IMenu } from '../../../Overlay/BaseMenu';

type ReceiptProps = {
  accountId?: string;
  networkId?: string;
  address?: string;
};

type AccountMoreMenusProps = {
  accountId?: string;
  networkId?: string;
};

export const AccountMoreMenus: FC<IMenu & AccountMoreMenusProps> = ({
  accountId,
  networkId,
  ...rest
}) => {
  const { copyText } = useClipboard();
  const { network } = useNetwork({ networkId });
  const { account } = useAccount({
    accountId: accountId ?? '',
    networkId: networkId ?? '',
  });
  const openBlockBrowser = useOpenBlockBrowser(network);
  const { openRootHome } = useNavigationActions();

  const onOpenAccount = useCallback(() => {
    if (account && networkId) {
      backgroundApiProxy.serviceAccount.changeCurrrentAccount({
        accountId: account.id,
        networkId,
      });
      openRootHome();
    }
  }, [openRootHome, account, networkId]);

  const options = useMemo(() => {
    const baseOptions: IBaseMenuOptions = [
      Boolean(account) && {
        id: 'action__view_account',
        onPress: () => onOpenAccount(),
        icon: 'UserOutline',
      },
      Boolean(account?.address && account?.address.length > 0) && {
        id: 'action__copy_address',
        onPress: () => copyText(account?.address ?? ''),
        icon: 'Square2StackOutline',
      },
      openBlockBrowser.hasAvailable && {
        id: 'action__view_in_browser',
        onPress: () => openBlockBrowser.openAddressDetails(account?.address),
        icon: 'ArrowTopRightOnSquareOutline',
      },
    ];
    return baseOptions;
  }, [copyText, openBlockBrowser, onOpenAccount, account]);

  return <BaseMenu options={options} {...rest} />;
};

export const ReceiptMoreMenus: FC<IMenu & ReceiptProps> = ({
  accountId,
  address,
  networkId,
  ...rest
}) => {
  const { copyText } = useClipboard();
  const { network } = useNetwork({ networkId });
  const { account } = useAccount({
    accountId: accountId ?? '',
    networkId: networkId ?? '',
  });
  const openBlockBrowser = useOpenBlockBrowser(network);
  const { openRootHome } = useNavigationActions();

  const onOpenAccount = useCallback(() => {
    if (account && networkId) {
      backgroundApiProxy.serviceAccount.changeCurrrentAccount({
        accountId: account.id,
        networkId,
      });
      openRootHome();
    }
  }, [openRootHome, account, networkId]);

  const options = useMemo(() => {
    const baseOptions: IBaseMenuOptions = [
      Boolean(account) && {
        id: 'action__view_account',
        onPress: () => onOpenAccount(),
        icon: 'UserOutline',
      },
      {
        id: 'action__copy_address',
        onPress: () => copyText(address ?? ''),
        icon: 'Square2StackOutline',
      },
      openBlockBrowser.hasAvailable && {
        id: 'action__view_in_browser',
        onPress: () => openBlockBrowser.openAddressDetails(address),
        icon: 'ArrowTopRightOnSquareOutline',
      },
    ];
    return baseOptions;
  }, [copyText, openBlockBrowser, onOpenAccount, address, account]);

  return <BaseMenu options={options} {...rest} />;
};
