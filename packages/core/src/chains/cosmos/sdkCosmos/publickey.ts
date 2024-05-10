import { bech32 } from 'bech32';

export const pubkeyToCosmosPublic = (pub: Buffer, hrp = 'cosmos') => {
  const AminoSecp256k1PubkeyPrefix = Buffer.from('EB5AE987', 'hex');
  const AminoSecp256k1PubkeyLength = Buffer.from('21', 'hex');
  const pubBuf = Buffer.concat([
    AminoSecp256k1PubkeyPrefix,
    AminoSecp256k1PubkeyLength,
    pub,
  ]);
  return bech32.encode(`${hrp}pub`, bech32.toWords(pubBuf));
};

export interface Publickey {
  '@type': string;
  key: string;
}
