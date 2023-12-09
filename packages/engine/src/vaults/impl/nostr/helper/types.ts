export enum EventKind {
  Metadata = 0,
  Text = 1,
  RelayRec = 2,
  Contacts = 3,
  DM = 4,
  Deleted = 5,
  Reaction = 7,
  BadgeAward = 8,
  ChannelCreation = 40,
  ChannelMetadata = 41,
  ChannelMessage = 42,
  ChannelHideMessage = 43,
  Reporting = 1984,
  ZapRequest = 9734,
  Zap = 9735,
  RelayListMetadata = 10002,
  ClientAuthentication = 22242,
  NostrConnect = 24133,
  ProfileBadges = 30008,
  BadgeDefinition = 30009,
  LongFormContent = 30023,
  ApplicationSpecificData = 30078,
}

export type NostrEvent = {
  id?: string;
  kind: EventKind;
  pubkey?: string;
  content: string;
  tags: string[][];
  created_at: number;
  sig?: string;
};

export const i18nSupportEventKinds = Object.values(EventKind);

export enum ESignType {
  signEvent = 'signEvent',
  signSchnorr = 'signSchnorr',
  encrypt = 'encrypt',
  decrypt = 'decrypt',
}

export type INostrRelays = {
  [url: string]: { read: boolean; write: boolean };
};

export interface IEncodedTxNostr {
  event: NostrEvent;
}
