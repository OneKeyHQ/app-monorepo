/**
 * Identity of the home-scene account that seeds the BulkSend sender.
 *
 * A derive-type switch elsewhere (e.g. the recipient picker's address-type
 * menu writes the network default) changes the home `account.id` but not its
 * indexed account or network. Re-seeding on that would discard a sender the
 * user already chose (OK-61627), so the key deliberately omits the derive
 * type. Wallets without indexed accounts (imported / watching) have no
 * derive-type variants, so their account id is the identity.
 */
export function buildBulkSendHomeAccountSeedKey({
  networkId,
  accountId,
  indexedAccountId,
}: {
  networkId: string | undefined;
  accountId: string | undefined;
  indexedAccountId: string | undefined;
}): string {
  return `${networkId ?? ''}|${indexedAccountId ?? accountId ?? ''}`;
}
