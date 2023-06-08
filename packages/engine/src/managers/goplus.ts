import B from 'bignumber.js';
import { uniq } from 'lodash';

import type { LocaleIds } from '@onekeyhq/components/src/locale';

import { GoPlusSupportApis } from '../types/goplus';
import { TokenRiskLevel } from '../types/token';

import { fetchData } from './token';

import type {
  GoPlusAddressSecurity,
  GoPlusDappContract,
  GoPlusDappSecurity,
  GoPlusPhishing,
  GoPlusTokenSecurity,
} from '../types/goplus';

type CheckItemFunc = (item: any) => boolean;

type LocaleType = LocaleIds | [LocaleIds, any];

// @ts-ignore
export const tokenSecurityRiskItems: Record<
  keyof GoPlusTokenSecurity,
  {
    safe?: [LocaleType, LocaleType];
    warn?: [LocaleType, LocaleType];
    danger?: [LocaleType, LocaleType];
  }
> = {
  'trust_list': {
    safe: ['form__trusted_token', 'form__trusted_token_desc'],
  },
  'is_open_source': {
    safe: ['form__source_code_verified', 'form__source_code_verified_desc'],
    danger: [
      'form__source_code_not_verified',
      'form__source_code_not_verified_desc',
    ],
  },
  'is_proxy': {
    safe: ['form__no_proxy', 'form__no_proxy_desc'],
    danger: ['form__proxy_contract_found', 'form__proxy_contract_found_desc'],
  },
  'can_take_back_ownership': {
    safe: [
      'form__ownership_cannot_be_taken_back',
      'form__ownership_cannot_be_taken_back_desc',
    ],
    danger: [
      'form__ownership_can_be_taken_back',
      'form__ownership_can_be_taken_back_desc',
    ],
  },
  'owner_change_balance': {
    safe: [
      'form__owner_cant_change_balance',
      'form__owner_cant_change_balance_desc',
    ],
    danger: [
      'form__owner_can_change_balance',
      'form__owner_can_change_balance_desc',
    ],
  },
  'hidden_owner': {
    safe: ['form__no_hidden_owner', 'form__no_hidden_owner_desc'],
    danger: ['form__hidden_owner', 'form__hidden_owner_desc'],
  },
  'selfdestruct': {
    safe: ['form__can_not_self_destruct', 'form__can_not_self_destruct_desc'],
    danger: ['form__can_self_destruct', 'form__can_self_destruct_desc'],
  },
  'external_call': {
    safe: [
      'form__no_external_call_risk_found',
      'form__no_external_call_risk_found_desc',
    ],
    danger: ['form__external_call_risk', 'form__external_call_risk_desc'],
  },
  'is_honeypot': {
    safe: [
      'form__not_appear_to_be_a_honeypot',
      'form__not_appear_to_be_a_honeypot_desc',
    ],
    danger: ['form__honeypot', 'form__honeypot_desc'],
  },
  'transfer_pausable': {
    safe: [
      'form__no_codes_found_to_suspend_trading',
      'form__no_codes_found_to_suspend_trading_desc',
    ],
    danger: ['form__pausable_transfer', 'form__pausable_transfer_desc'],
  },
  'cannot_sell_all': {
    safe: [
      'form__can_sell_all_of_the_token',
      'form__can_sell_all_of_the_token_desc',
    ],
    danger: ['form__can_not_sell_all', 'form__can_not_sell_all_desc'],
  },
  'cannot_buy': {
    safe: ['form__can_be_bought', 'form__can_be_bought_desc'],
    danger: ['form__can_not_be_bought', 'form__can_not_be_bought_desc'],
  },
  'trading_cooldown': {
    safe: [
      'form__no_trading_cooldown_function',
      'form__no_trading_cooldown_function_desc',
    ],
    danger: [
      'form__trading_with_cooldown_time',
      'form__trading_with_cooldown_time_desc',
    ],
  },
  'is_anti_whale': {
    safe: ['form__no_anti_whale', 'form__no_anti_whale_desc'],
    danger: ['form__anti_whale', 'form__anti_whale_desc'],
  },
  'slippage_modifiable': {
    safe: [
      'form__tax_can_not_be_modified',
      'form__tax_can_not_be_modified_desc',
    ],
    danger: ['form__modifiable_tax', 'form__modifiable_tax_desc'],
  },
  'is_blacklisted': {
    safe: ['form__no_blacklist', 'form__no_blacklist_desc'],
    danger: ['form__blacklist_included', 'form__blacklist_included_desc'],
  },
  'is_whitelisted': {
    safe: ['form__no_whitelist', 'form__no_whitelist_desc'],
    danger: ['form__whitelist_included', 'form__whitelist_included_desc'],
  },
  'personal_slippage_modifiable': {
    safe: [
      'form__no_tax_changes_found_for_personal_addresses',
      'form__no_tax_changes_found_for_personal_addresses_desc',
    ],
    danger: [
      'form__assinged_address_slippage_is_modifiable',
      'form__assinged_address_slippage_is_modifiable_desc',
    ],
  },
  'is_true_token': {
    danger: ['form__airdrop_scam', 'form__airdrop_scam_desc'],
  },
  'is_airdrop_scam': {
    danger: ['form__airdrop_scam', 'form__airdrop_scam_desc'],
  },
  'buy_tax': {
    danger: [
      'form__too_much_buy_tax',
      ['form__too_much_buy_tax_desc', { 0: '50%' }],
    ],
    warn: ['form__high_buy_tax', ['form__high_buy_tax_desc', { 0: '10%' }]],
  },
  'sell_tax': {
    danger: [
      'form__too_much_sell_tax',
      ['form__too_much_sell_tax_desc', { 0: '50%' }],
    ],
    warn: ['form__high_sell_tax', ['form__high_sell_tax_desc', { 0: '10%' }]],
  },
  // 'is_mintable': {
  //   warn: [
  //     'form__token_can_be_issued_additionall',
  //     'form__token_can_be_issued_additionall_desc',
  //   ],
  //   safe: ['form__no_additional_issuance', 'form__no_additional_issuance_desc'],
  // },
} as const;

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
  // ['is_mintable', (data) => data === '1'],
  ['can_take_back_ownership', (data) => data === '1'],
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
  ['trust_list', (data) => data === '1'],
  ['is_open_source', (data) => data === '1'],
  ['is_proxy', (data) => data === '0'],
  ['can_take_back_ownership', (data) => data === '0'],
  ['owner_change_balance', (data) => data === '0'],
  ['hidden_owner', (data) => data === '0'],
  ['external_call', (data) => data === '0'],
  ['selfdestruct', (data) => data === '0'],
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

const isDropedPermission = (info: GoPlusTokenSecurity) =>
  info.owner_address === '0x0000000000000000000000000000000000000000' &&
  info.can_take_back_ownership === '0' &&
  info.hidden_owner === '0';

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
  const res = [
    {
      localeKey: 'safe',
      items: safeItems,
    },
    { localeKey: 'danger', items: dangerItems },
    { localeKey: 'warn', items: isDropedPermission(info) ? [] : warnItems },
  ].map(({ localeKey, items }) =>
    uniq(items.filter(([k, func]) => func(info?.[k])).map(([k]) => k)).filter(
      // @ts-ignore
      (item) => localeKey !== 'safe' || tokenSecurityRiskItems[item][localeKey],
    ),
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
  return uniq(
    addressItems.filter(([k, func]) => func(info?.[k])).map(([k]) => k),
  );
};

export const getSiteRiskyItems = (
  info: Partial<GoPlusDappContract & GoPlusPhishing>,
) => {
  if (!info) {
    return [];
  }
  return uniq(
    dappDangerItems.filter(([k, func]) => func(info?.[k])).map(([k]) => k),
  );
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

export const fetchValidGoPlusChainId = async (
  apiName: GoPlusSupportApis,
  networkId: string,
) => fetchData('/token/gp_valid_chain_id', { apiName, networkId }, undefined);

export const getRiskLevel = (info: GoPlusTokenSecurity) => {
  if (isTrustToken(info)) {
    return TokenRiskLevel.VERIFIED;
  }
  if (dangerItems.filter(([k, func]) => func(info?.[k])).length) {
    return TokenRiskLevel.DANGER;
  }
  if (warnItems.filter(([k, func]) => func(info?.[k])).length) {
    return TokenRiskLevel.WARN;
  }
  return TokenRiskLevel.UNKNOWN;
};
