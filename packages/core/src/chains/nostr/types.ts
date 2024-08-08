export enum EEventKind {
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
  RelayListMetadata = 10_002,
  ClientAuthentication = 22_242,
  NostrConnect = 24_133,
  ProfileBadges = 30_008,
  BadgeDefinition = 30_009,
  LongFormContent = 30_023,
  ApplicationSpecificData = 30_078,
}

export type INostrEvent = {
  id?: string;
  kind: EEventKind;
  pubkey?: string;
  content: string;
  tags: string[][];
  created_at: number;
  sig?: string;
};

export const i18nSupportEventKinds = Object.values(EEventKind);

export enum ENostrSignType {
  signEvent = 'signEvent',
  signSchnorr = 'signSchnorr',
  encrypt = 'encrypt',
  decrypt = 'decrypt',
}

export type INostrRelays = {
  [url: string]: { read: boolean; write: boolean };
};

export interface IEncodedTxNostr {
  event: INostrEvent;
}
