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

export function asLinkConfigItems(items: unknown): ILinkConfigItem[] {
  // Utility already owns the array contract; this only fails closed on
  // a non-array wire payload.
  return Array.isArray(items)
    ? (items as ILinkConfigItem[])
    : EMPTY_LINK_CONFIG_ITEMS;
}
