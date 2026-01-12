import * as MediaLibrary from 'expo-media-library';

const mediaLibrary = {
  saveToLibraryAsync: (uri: string) => MediaLibrary.saveToLibraryAsync(uri),
  requestPermissionsAsync: (writeOnly?: boolean) =>
    MediaLibrary.requestPermissionsAsync(writeOnly),
  getPermissionsAsync: (writeOnly?: boolean) =>
    MediaLibrary.getPermissionsAsync(writeOnly),
};

export default mediaLibrary;
export type { MediaLibrary };
