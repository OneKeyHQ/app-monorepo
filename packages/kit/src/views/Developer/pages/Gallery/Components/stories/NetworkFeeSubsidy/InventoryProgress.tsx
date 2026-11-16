import { useReducedMotion } from 'react-native-reanimated';

import { Progress } from '@onekeyhq/components';

export function InventoryProgress({ value }: { value: number }) {
  const reducedMotion = useReducedMotion();
  return (
    <Progress
      animated={!reducedMotion}
      indicatorTransition="slow"
      value={value}
      size="medium"
      progressColor="$bgStrong"
      indicatorColor="$bgAccent"
    />
  );
}
