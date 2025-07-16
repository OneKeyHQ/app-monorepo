import { YStack } from '../../primitives';

import { useTabsScrollContext } from './context';

export function ScrollView({ children }: { children: React.ReactNode }) {
  const { width } = useTabsScrollContext();
  return (
    <YStack flex={1} width={width}>
      {children}
    </YStack>
  );
}
