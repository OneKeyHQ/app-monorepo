import B from 'bignumber.js';

import {
  GoPlusAddressSecurity,
  GoPlusDappContract,
  GoPlusDappSecurity,
  GoPlusPhishing,
  GoPlusSupportApis,
  GoPlusTokenSecurity,
} from '../types/goplus';

import { fetchData } from './token';

type CheckItemFunc = (item: any) => boolean;

export type CheckParams = {
  networkId: string;
  address: string;
  apiName: GoPlusSupportApis;
};

export const dangerItems: [keyof GoPlusTokenSecurity, CheckItemFunc][] = [
  ['is_open_source', (data) => data === '0'],
  ['owner_change_balance', (data) => data === '1'],
  ['selfdestruct', (data) => data === '1'],
  ['buy_tax', (data) => new B(data).multipliedBy(100).isGreaterThan(50)],
  ['sell_tax', (data) => new B(data).multipliedBy(100).isGreaterThan(50)],
  ['is_honeypot', (data) => data === '1'],
  ['is_true_token', (data) => data === '0'],
  ['is_airdrop_scam', (data) => data === '1'],
];

export const warnItems: [keyof GoPlusTokenSecurity, CheckItemFunc][] = [
  ['is_proxy', (data) => data === '1'],
  ['is_mintable', (data) => data === '1'],
  ['can_take_back_ownership', (data) => data === '1'],
  ['owner_change_balance', (data) => data === '1'],
  ['hidden_owner', (data) => data === '1'],
  ['external_call', (data) => data === '1'],
  [
    'buy_tax',
    (data) => {
      const d = new B(data).multipliedBy(100);
      return d.isGreaterThan(10) && d.isLessThan(50);
    },
  ],
  [
    'sell_tax',
    (data) => {
      const d = new B(data).multipliedBy(100);
      return d.isGreaterThan(10) && d.isLessThan(50);
    },
  ],
  ['transfer_pausable', (data) => data === '1'],
  ['cannot_sell_all', (data) => data === '1'],
  ['cannot_buy', (data) => data === '1'],
  ['trading_cooldown', (data) => data === '1'],
  ['is_anti_whale', (data) => data === '1'],
  ['is_blacklisted', (data) => data === '1'],
  ['is_whitelisted', (data) => data === '1'],
  ['slippage_modifiable', (data) => data === '1'],
  ['personal_slippage_modifiable', (data) => data === '1'],
];

export const safeItems: [keyof GoPlusTokenSecurity, CheckItemFunc][] = [
  ['trust_list', (data) => data !== '0'],
  ['is_open_source', (data) => data !== '0'],
  ['is_proxy', (data) => data !== '0'],
  ['can_take_back_ownership', (data) => data !== '0'],
  ['owner_change_balance', (data) => data !== '0'],
  ['hidden_owner', (data) => data !== '0'],
  ['external_call', (data) => data !== '0'],
  ['selfdestruct', (data) => data !== '0'],
  ...warnItems.map(
    ([k, v]) =>
      [k, (data) => !v(data)] as [keyof GoPlusTokenSecurity, CheckItemFunc],
  ),
  ...dangerItems.map(
    ([k, v]) =>
      [k, (data) => !v(data)] as [keyof GoPlusTokenSecurity, CheckItemFunc],
  ),
];

export const addressItems: [keyof GoPlusAddressSecurity, CheckItemFunc][] = [
  ['honeypot_related_address', (d) => d === '1'],
  ['phishing_activities', (d) => d === '1'],
  ['blackmail_activities', (d) => d === '1'],
  ['stealing_attack', (d) => d === '1'],
  ['fake_kyc', (d) => d === '1'],
  ['malicious_mining_activities', (d) => d === '1'],
  ['darkweb_transactions', (d) => d === '1'],
  ['cybercrime', (d) => d === '1'],
  ['money_laundering', (d) => d === '1'],
  ['financial_crime', (d) => d === '1'],
  ['blacklist_doubt', (d) => d === '1'],
];

export const dappDangerItems: [
  keyof GoPlusDappContract | keyof GoPlusPhishing,
  CheckItemFunc,
][] = [
  ['is_open_source', (d) => d === 0],
  ['malicious_contract', (d) => d === 1],
  ['malicious_creator', (d) => d === 1],
  ['phishing_site', (d) => d === 1],
];

export const fetchSecurityInfo = async <T>(
  params: CheckParams,
): Promise<T | undefined> => {
  const data = await fetchData('/token/security', params, undefined);
  if (params.apiName === GoPlusSupportApis.token_security) {
    return data?.[params.address];
  }
  return data;
};

export const isTrustToken = (info: GoPlusTokenSecurity) =>
  info?.trust_list === '1';

export const getTokenRiskyItems = async (params: CheckParams) => {
  const info = await fetchSecurityInfo<GoPlusTokenSecurity>(params);
  if (!info) {
    return {
      safe: [],
      danger: [],
      warn: [],
      hasSecurity: false,
    };
  }
  const res = [safeItems, dangerItems, warnItems].map((items) =>
    items.filter(([k, func]) => func(info?.[k])).map(([k]) => k),
  );

  if (isTrustToken(info)) {
    return {
      safe: res[0],
      danger: [],
      warn: [],
      hasSecurity: false,
    };
  }
  return {
    safe: res[0],
    danger: res[1],
    warn: res[2],
    hasSecurity: !![...res[1], ...res[2]].length,
  };
};

export const getAddressRiskyItems = async (params: CheckParams) => {
  const info = await fetchSecurityInfo<GoPlusAddressSecurity>(params);
  if (!info) {
    return [];
  }
  return addressItems.filter(([k, func]) => func(info?.[k])).map(([k]) => k);
};

export const getSiteRiskyItems = (
  info: Partial<GoPlusDappContract & GoPlusPhishing>,
) => {
  if (!info) {
    return [];
  }
  return dappDangerItems.filter(([k, func]) => func(info?.[k])).map(([k]) => k);
};

export const checkSite = async (
  url: string,
  networkId: string,
): Promise<(keyof GoPlusDappContract | keyof GoPlusPhishing)[]> => {
  const data = await fetchData<Partial<GoPlusDappSecurity>>(
    '/token/site',
    { url, networkId },
    {},
  );
  const { dappSecurity, phishing, chainId } = data ?? {};
  if (dappSecurity?.is_audit === 1) {
    return [];
  }

  const contractItems =
    dappSecurity?.contracts_security
      .find((c) => String(c.chain_id) === chainId)
      ?.contracts?.map((c) => getSiteRiskyItems(c))
      ?.flat() ?? [];

  const phishingItems = getSiteRiskyItems(phishing ?? {});

  return Array.from(new Set([...contractItems, ...phishingItems]));
};
