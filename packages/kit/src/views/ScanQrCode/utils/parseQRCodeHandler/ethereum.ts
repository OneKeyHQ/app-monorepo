import { EQRCodeHandlerType } from './type';

import type { IEthereumValue, IQRCodeHandler } from './type';

// eth://0x5ABC
// ethereum://0x5ABC

// from https://github.com/ethereumclassic/ECIPs/blob/f707477eda9ad773ea667a0f43c0fff968b07dcd/_specs/ecip-1037.md
export const ethereum: IQRCodeHandler<IEthereumValue> = (value, options) => {
  const urlValue = options?.urlResult;
  if (urlValue) {
    if (
      ['ethereum'].findIndex((item) => item === urlValue.data.urlSchema) !== -1
    ) {
      const { amount, id, label, message, gas, glmt, n, code, ...paramList } =
        urlValue.data.urlParamList;
      const ethereumValue: IEthereumValue = {
        address: urlValue.data.urlPathList?.[0],
        id: Number(id),
        label,
        gas: Number(gas),
        glmt: Number(glmt),
        n: Number(n),
        code,
        message,
        paramList,
      };
      if (amount) {
        const amountNumber = Number(amount);
        if (!Number.isFinite(amountNumber)) throw new Error('Invalid amount');
        if (amountNumber < 0) throw new Error('Invalid amount');
        ethereumValue.amount = amountNumber;
      }
      return {
        type: EQRCodeHandlerType.ETHEREUM,
        data: ethereumValue,
      };
    }
  }
  return null;
};
