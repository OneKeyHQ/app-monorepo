import { createMMKV } from 'react-native-mmkv';

export type IOneKeyMMKVConfiguration = {
  id: string;
  enableWriteProtection: boolean;
};

const mmkvWriteProtectionRegistry = new Map<string, boolean>([
  ['onekey-app-storage-v1', true],
  ['onekey-jotai-states', true],
  ['onekey-app-setting', true],
  ['onekey-local-secret-envelope', true],
  ['onekey-app-dev-setting', false],
]);

export function isOneKeyMMKVWriteProtected(id: string): boolean {
  const registered = mmkvWriteProtectionRegistry.get(id);
  if (registered !== undefined) {
    return registered;
  }
  if (id.startsWith('onekey-display-snapshot-')) {
    return false;
  }
  return false;
}

export function createOneKeyMMKV({
  id,
  enableWriteProtection,
}: IOneKeyMMKVConfiguration) {
  mmkvWriteProtectionRegistry.set(id, enableWriteProtection);
  return createMMKV({ id });
}
