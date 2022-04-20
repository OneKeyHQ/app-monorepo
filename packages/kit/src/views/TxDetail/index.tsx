import React, { FC, useEffect } from 'react';

import { ethers } from '@onekeyfe/blockchain-libs';

import { Modal } from '@onekeyhq/components';
import {
  EVMDecodedItem,
  EVMTxDecoder,
} from '@onekeyhq/engine/src/vaults/impl/evm/decoder/decoder';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import TokenApprove from './TokenApprove';

const TxDetailDemo: FC = () => {
  // https://etherscan.io/tx/0xea242bcaa38cbb3d4c9283b5076a55a454097e20cfac89688f46d7b6b7e1d2f1
  const rawTx =
    '0xf8a91b8502bd8bf28082dc88941f9840a85d5af5bf1d1762f925bdaddc4201f98480b844095ea7b3000000000000000000000000c36442b4a4522e871399cd717abdd847ab11fe88ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff25a0696ccd7ecc77e97853d989d55be27d4d71d59a87d2ac8ad0772808f6e7909c4ea05c84fcf32d9f6f494575d97947bddbfb1308460cd49504cc93ace5af394d015e';

  const [decodedTx, setDecodedTx] = React.useState<EVMDecodedItem | null>(null);
  useEffect(() => {
    async function decode() {
      const tx = ethers.utils.parseTransaction(rawTx);
      const decoded = await EVMTxDecoder.decode(tx, backgroundApiProxy.engine);
      setDecodedTx(decoded);
    }
    decode();
  }, []);
  return (
    <Modal
      scrollViewProps={{
        pt: 4,
        children: (
          <TokenApprove
            tx={decodedTx}
            sourceInfo={{
              origin: 'app.uniswap.org',
              id: '0x0',
              scope: 'ethereum',
              data: '0x0',
            }}
          />
        ),
      }}
    />
  );
};
export default TxDetailDemo;
