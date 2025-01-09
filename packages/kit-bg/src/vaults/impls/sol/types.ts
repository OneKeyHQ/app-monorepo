export type IParsedAccountInfo = {
  data: { parsed: { info: { mint: string; owner: string } } };
};

export type IAssociatedTokenInfo = {
  mint: string;
  owner: string;
};
