import type { IShortcutKeyProps, IShortcutProps } from './type';

function ShortcutKey(_: IShortcutKeyProps) {
  return null;
}

export function Shortcut(_: IShortcutProps) {
  return null;
}

Shortcut.Key = ShortcutKey;

export * from './type';
