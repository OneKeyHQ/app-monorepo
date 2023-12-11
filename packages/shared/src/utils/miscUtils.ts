import uuid from 'react-native-uuid';

export function generateUUID() {
  return uuid.v4() as string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function noopObject(..._: any[]) {
  return null;
}
