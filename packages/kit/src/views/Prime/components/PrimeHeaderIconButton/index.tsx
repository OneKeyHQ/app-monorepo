import { Suspense, lazy } from 'react';

const PrimeHeaderIconButton = lazy(() =>
  import('./PrimeHeaderIconButton').then((m) => ({
    default: m.PrimeHeaderIconButton,
  })),
);

export function PrimeHeaderIconButtonLazy({
  visible,
  onPress,
  networkId,
}: {
  visible: boolean;
  onPress?: () => void;
  networkId?: string;
  size?: 'small' | 'medium';
}) {
  if (!visible) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <PrimeHeaderIconButton onPress={onPress} networkId={networkId} />
    </Suspense>
  );
}
