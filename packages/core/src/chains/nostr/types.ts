import type { EEventKind } from '@onekeyhq/shared/src/types/nostr';

export {
  EEventKind,
  ENostrSignType,
  i18nSupportEventKinds,
} from '@onekeyhq/shared/src/types/nostr';

export type INostrEvent = {
  id?: string;
  kind: EEventKind;
  pubkey?: string;
  content: string;
  tags: string[][];
  created_at: number;
  sig?: string;
};

export type INostrRelays = {
  [url: string]: { read: boolean; write: boolean };
};

export interface IEncodedTxNostr {
  event: INostrEvent;
}
