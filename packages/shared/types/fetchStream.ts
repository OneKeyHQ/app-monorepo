export const FETCH_STREAM_MESSAGE = 'fetch/stream';

export type IFetchStreamRequest =
  | {
      action: 'open';
      url: string;
      method?: string;
      headers: [string, string][];
      b64?: string;
    }
  | { action: 'read' | 'cancel'; id: string };

export type IFetchStreamResult =
  | { ok: false; error: string }
  | {
      ok: true;
      response: {
        id: string;
        status: number;
        statusText: string;
        headers: [string, string][];
      };
    }
  | { ok: true; chunk: { done: boolean; b64: string } }
  | { ok: true; cancelled: true };

export type IFetchStreamRequester = (
  request: IFetchStreamRequest,
) => Promise<IFetchStreamResult>;
