import { FETCH_STREAM_MESSAGE } from '../../types/fetchStream';

import type { IFetchStreamRequester } from '../../types/fetchStream';

export const hostFetchStream: IFetchStreamRequester = async (request) =>
  chrome.runtime.sendMessage({
    type: FETCH_STREAM_MESSAGE,
    request,
  });
