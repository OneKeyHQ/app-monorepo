import { OneKeyLocalError } from '../errors';

import type { IFetchStreamRequester } from '../../types/fetchStream';

export const hostFetchStream: IFetchStreamRequester = async (request) => {
  const api = globalThis.desktopApi?.fetchStream;
  if (!api) {
    throw new OneKeyLocalError('desktop fetch stream channel unavailable');
  }
  return api(request);
};
