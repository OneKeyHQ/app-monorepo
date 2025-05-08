import { Suspense, lazy } from 'react';

const PrimeHeaderIconButton = lazy(() =>
  import('./PrimeHeaderIconButton').then((m) => ({
    default: m.PrimeHeaderIconButton,
  })),
);

export function PrimeHeaderIconButtonLazy({
  visible,
  onPress,
}: {
  visible: boolean;
  onPress?: () => void;
}) {
  if (!visible) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <PrimeHeaderIconButton onPress={onPress} />
    </Suspense>
  );
}
