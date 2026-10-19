import type { IFetchStreamRequester } from '../../types/fetchStream';

// React Native background fetch already uses native networking.
export const hostFetchStream: IFetchStreamRequester | undefined = undefined;
