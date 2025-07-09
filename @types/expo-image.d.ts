import type { ImageSource } from 'expo-image';

declare module 'expo-image/src/utils/resolveSources' {
  export function resolveSource(
    source: ImageSource | string | number | null,
  ): ImageSource | null;
}
