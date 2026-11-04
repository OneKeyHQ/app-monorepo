import type { IFetchStreamRequester } from '../../types/fetchStream';

// Plain web uses the runtime's browser Fetch and retains its CORS requirements.
export const hostFetchStream: IFetchStreamRequester | undefined = undefined;
