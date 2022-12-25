import axios from 'axios';

import { OneKeyError } from '@onekeyhq/engine/src/errors';
import { addHexPrefix } from '@onekeyhq/engine/src/vaults/utils/hexUtils';

import { RPCBody } from './RPCBody';

import type { AxiosError, AxiosResponse } from 'axios';

const MAX_RETRIES = 3;

export abstract class JsonRpcClient {
  protected async sendRepeat(
    baseURL: string,
    method: string,
    params: any[],
    attempts = 0,
  ): Promise<any> {
    const handleResponse = (response: AxiosResponse<any>) => {
      const { data } = response;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (data.error) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        throw data.error;
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
      return data.result;
    };

    const handleAxiosError = async (error: AxiosError) => {
      if (error.response?.status === 500 && attempts < MAX_RETRIES) {
        return this.sendRepeat(baseURL, method, params, attempts + 1);
      }
      throw new OneKeyError(error.message);
    };

    const handleError = async (error: any) => {
      if (typeof error === 'string') {
        throw new OneKeyError(error);
      } else {
        const axiosError = error as AxiosError;
        return handleAxiosError(axiosError);
      }
    };

    return axios
      .post(baseURL, new RPCBody(method, params.map(addHexPrefix)))
      .then(handleResponse)
      .catch(handleError);
  }
}
