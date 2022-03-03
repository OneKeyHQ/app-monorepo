import { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';
import { useRoute } from '@react-navigation/core';

import { IDappCallParams } from '../background/IBackgroundApi';

function useDappParams() {
  const route = useRoute();
  const params = route.params as IDappCallParams;
  let data: IJsonRpcRequest = {
    method: '',
    params: [],
  };
  try {
    data = JSON.parse(params.data);
  } catch (error) {
    console.error(`parse dapp params.data error: ${params.data}`);
  }
  return {
    ...params,
    data,
  };
}

export default useDappParams;
