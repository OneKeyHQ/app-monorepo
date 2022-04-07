import { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';
import { useRoute } from '@react-navigation/core';

import { IDappCallParams } from '../background/IBackgroundApi';

type Params<T> = Record<string, T> | Array<T> | T;

function useDappParams<T>() {
  const route = useRoute();
  const params = (route.params as { source?: IDappCallParams })
    ?.source as IDappCallParams;
  let data: IJsonRpcRequest = {
    method: '',
    params: [],
  };
  try {
    if (params) {
      data = JSON.parse(params.data);
    }
  } catch (error) {
    console.error(`parse dapp params.data error: ${params?.data}`);
  }
  return {
    ...params,
    data: {
      ...data,
      params: data?.params as Params<T>,
    },
  };
}

export default useDappParams;
