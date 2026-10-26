export function canAccessBulkSend({
  isE2E,
  isPrimeActive,
  oneKeyUserId,
}: {
  isE2E: boolean;
  isPrimeActive: boolean;
  oneKeyUserId?: string | null;
}) {
  return isE2E || Boolean(isPrimeActive && oneKeyUserId);
}
