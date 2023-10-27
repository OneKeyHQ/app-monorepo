import uuid from 'react-native-uuid';

export function generateUUID() {
  return uuid.v4() as string;
}
