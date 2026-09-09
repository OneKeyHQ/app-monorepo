const SIMPLE_DB_KEY_PREFIX = 'simple_db_v5';
const CUSTOM_TOKEN_ACCOUNT_KEY_SPLITTER = '__account:';

export function getSimpleDbEntityKey(entityName: string) {
  return `${SIMPLE_DB_KEY_PREFIX}:${entityName}`;
}

export function getXpubOrAddressFromAccountKey(
  accountKey: string,
): string | null {
  const [, accountXpubOrAddress] = accountKey.split(
    CUSTOM_TOKEN_ACCOUNT_KEY_SPLITTER,
  );
  return accountXpubOrAddress;
}

export { CUSTOM_TOKEN_ACCOUNT_KEY_SPLITTER };
