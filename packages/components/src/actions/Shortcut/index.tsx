import type {
  IShortcutContentProps,
  IShortcutKeyProps,
  IShortcutProps,
} from './type';

function ShortcutKey(props: IShortcutKeyProps) {
  return null;
}

function ShortcutContent({ shortcutKey }: IShortcutContentProps) {
  return null;
}

export function Shortcut(props: IShortcutProps) {
  return null;
}

Shortcut.Key = ShortcutKey;

export * from './type';
