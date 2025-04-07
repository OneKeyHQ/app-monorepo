import type {
  IShortcutContentProps,
  IShortcutKeyProps,
  IShortcutProps,
} from './type';

function ShortcutKey(_: IShortcutKeyProps) {
  return null;
}

export function ShortcutContent(_: IShortcutContentProps) {
  return null;
}

export function Shortcut(_: IShortcutProps) {
  return null;
}

Shortcut.Key = ShortcutKey;

export * from './type';
