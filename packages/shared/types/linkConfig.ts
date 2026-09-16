export const PRIME_GIFT_CLAIM_SUCCESS_LINK_SLOT =
  'pro2_prime_claim_success' as const;

export type ILinkConfigSlot =
  | 'hardware_faqs'
  | 'hardware_getstarteds'
  | typeof PRIME_GIFT_CLAIM_SUCCESS_LINK_SLOT;

export type ILinkConfigItem = {
  linkId: string;
  title: string;
  description: string;
  mode: number;
  payload: string;
  image: string | null;
};

const EMPTY_LINK_CONFIG_ITEMS: ILinkConfigItem[] = [];

function isLinkConfigItemArray(items: unknown): items is ILinkConfigItem[] {
  return Array.isArray(items);
}

export function asLinkConfigItems(items: unknown): ILinkConfigItem[] {
  return isLinkConfigItemArray(items) ? items : EMPTY_LINK_CONFIG_ITEMS;
}
