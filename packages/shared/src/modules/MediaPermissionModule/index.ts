// No-op for non-native platforms (desktop, web, extension)
export default undefined as
  | {
      setMediaPermissionWhitelist: (origins: string[]) => void;
    }
  | undefined;
