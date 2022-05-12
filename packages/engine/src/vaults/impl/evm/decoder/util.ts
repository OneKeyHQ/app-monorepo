import { ethers } from '@onekeyfe/blockchain-libs';

const ethersTxToJson = (nativeTx: ethers.Transaction): Promise<string> => {
  const json = JSON.stringify(nativeTx);
  return Promise.resolve(json);
};

const jsonToEthersTx = (json: string): Promise<ethers.Transaction> => {
  /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
  const tx = JSON.parse(json, (key, value) => {
    if (!!value && value.type === 'BigNumber' && 'hex' in value) {
      return ethers.BigNumber.from(value.hex);
    }
    return value;
  });
  return Promise.resolve(tx);
  /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
};

export { ethersTxToJson, jsonToEthersTx };
