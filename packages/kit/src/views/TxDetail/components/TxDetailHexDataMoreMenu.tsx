import type { FC } from 'react';
import { useMemo } from 'react';

import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import type { IDecodedTx } from '@onekeyhq/engine/src/vaults/types';

import { useClipboard } from '../../../hooks/useClipboard';
import BaseMenu from '../../Overlay/BaseMenu';

import type { IBaseMenuOptions, IMenu } from '../../Overlay/BaseMenu';

interface Props extends IMenu {
  decodedTx: IDecodedTx;
}
export const TxDetailHexDataMoreMenu: FC<Props> = (props) => {
  const { decodedTx } = props;
  const { copyText } = useClipboard();
  const options = useMemo(() => {
    const baseOptions: IBaseMenuOptions = [
      {
        id: 'action__copy',
        onPress: () =>
          copyText((decodedTx.encodedTx as IEncodedTxEvm)?.data ?? ''),
        icon: 'Square2StackOutline',
      },
    ];
    return baseOptions;
  }, [copyText, decodedTx.encodedTx]);

  return <BaseMenu options={options} {...props} />;
};
