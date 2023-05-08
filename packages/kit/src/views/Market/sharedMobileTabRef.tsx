import RootSiblingsManager from 'react-native-root-siblings';

// export in a separate file to avoid hot reload
// to create multiple instances when developing
export const sharedMobileTabRef = new RootSiblingsManager(null);
