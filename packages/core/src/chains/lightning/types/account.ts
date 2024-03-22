export type ICreateUserResponse = {
  id: number;
  login: string;
};

export type IAuthParams = {
  login: string;
  password: string;
  refresh_token: string;
};

export type IAuthResponse = {
  access_token: string;
  refresh_token: string;
};

export type IBalanceResponse = {
  balance: number;
  currency: string;
  unit: string;
};

export type IBatchBalanceResponse = {
  balance: number;
  address: string;
};
