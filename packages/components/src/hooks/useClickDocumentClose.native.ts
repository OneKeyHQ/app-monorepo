import { useMemo } from 'react';

import uuid from 'react-native-uuid';

export function useDomID(name: string) {
  const domId = useMemo(() => `${name}-${uuid.v4() as string}`, [name]);
  return { domId };
}

export default function useClickDocumentClose({
  name,
}: {
  name: string;
  visible: boolean;
  toggleVisible?: (...args: any) => any;
}): { domId: string } {
  const { domId } = useDomID(name);

  return { domId };
}
