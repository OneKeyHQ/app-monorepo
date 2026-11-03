import { OneKeyLocalError } from '../errors';

import type {
  IFetchStreamRequester,
  IFetchStreamResult,
} from '../../types/fetchStream';

export const hostFetchStream: IFetchStreamRequester = async (request) => {
  const channel = (
    globalThis as {
      $onekey?: {
        $private?: {
          request: (args: {
            method: string;
            params: unknown;
          }) => Promise<unknown>;
        };
      };
    }
  ).$onekey?.$private;
  if (!channel) {
    throw new OneKeyLocalError('native fetch stream channel unavailable');
  }
  return (await channel.request({
    method: 'fetchStream',
    params: request,
  })) as IFetchStreamResult;
};
