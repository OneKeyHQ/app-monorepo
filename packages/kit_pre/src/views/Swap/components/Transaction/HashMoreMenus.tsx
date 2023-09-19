import type { FC } from 'react';
import { useMemo } from 'react';

import { useClipboard } from '../../../../hooks/useClipboard';
import { useNetwork } from '../../../../hooks/useNetwork';
import useOpenBlockBrowser from '../../../../hooks/useOpenBlockBrowser';
import BaseMenu from '../../../Overlay/BaseMenu';

import type { IBaseMenuOptions, IMenu } from '../../../Overlay/BaseMenu';
import type { TransactionDetails } from '../../typings';

type Props = {
  tx: TransactionDetails;
};

export const HashMoreMenu: FC<IMenu & Props> = ({ tx, ...rest }) => {
  const { networkId, hash } = tx;
  const { copyText } = useClipboard();
  const { network } = useNetwork({ networkId });
  const openBlockBrowser = useOpenBlockBrowser(network);
  const options = useMemo(() => {
    const baseOptions: IBaseMenuOptions = [
      {
        id: 'action_copy_hash',
        onPress: () => copyText(hash),
        icon: 'Square2StackOutline',
      },
      openBlockBrowser.hasAvailable && {
        id: 'action__view_in_browser',
        onPress: () => openBlockBrowser.openTransactionDetails(hash),
        icon: 'ArrowTopRightOnSquareOutline',
      },
    ];
    return baseOptions;
  }, [copyText, hash, openBlockBrowser]);

  return <BaseMenu options={options} {...rest} />;
};
