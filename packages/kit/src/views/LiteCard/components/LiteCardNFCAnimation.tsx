import { LottieView } from '@onekeyhq/components';

export function LiteCardNFCAnimation({
  state,
  height,
}: {
  state: 'searching' | 'connecting';
  height: number;
}) {
  return (
    <LottieView
      source={
        state === 'connecting'
          ? require('@onekeyhq/kit/assets/animations/connect_onekeylite_connecting.json')
          : require('@onekeyhq/kit/assets/animations/connect_onekeylite_searching.json')
      }
      height={height}
    />
  );
}
