import * as MediaLibrary from 'expo-media-library';

const mediaLibrary = {
  saveToLibraryAsync: async (uri: string): Promise<void> => {
    await MediaLibrary.Asset.create(uri);
  },
  requestPermissionsAsync: (writeOnly?: boolean) =>
    MediaLibrary.requestPermissionsAsync(writeOnly),
  getPermissionsAsync: (writeOnly?: boolean) =>
    MediaLibrary.getPermissionsAsync(writeOnly),
};

export default mediaLibrary;
export type { MediaLibrary };
