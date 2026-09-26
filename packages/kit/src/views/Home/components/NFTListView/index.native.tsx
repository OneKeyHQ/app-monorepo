import { Suspense, lazy } from 'react';
import type { ComponentProps } from 'react';

import { NFTListLoadingView } from '@onekeyhq/kit/src/components/Loading';

const NativeNFTListView = lazy(() =>
  import('./NativeNFTList.native').then(({ NFTListView: Component }) => ({
    default: Component,
  })),
);

export function NFTListView(props: ComponentProps<typeof NativeNFTListView>) {
  return (
    <Suspense fallback={<NFTListLoadingView />}>
      <NativeNFTListView {...props} />
    </Suspense>
  );
}
