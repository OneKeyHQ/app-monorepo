import { Image } from '@onekeyhq/components';

// Official provider marks, bundled at 60×60 (rendered 20×20, so ~3× density)
// and cropped round in the UI. Sources: Coinbase GitHub org avatar (the
// full-bleed C mark Franco picked) / cdn.paybis.com android-chrome icon,
// fetched 2026-07-17. Unknown slugs render nothing — callers show name-only.
const PROVIDER_LOGOS: Record<string, number> = {
  coinbasepay: require('@onekeyhq/kit/assets/onramp_coinbasepay.png'),
  coinbase: require('@onekeyhq/kit/assets/onramp_coinbasepay.png'),
  paybis: require('@onekeyhq/kit/assets/onramp_paybis.png'),
};

export function ProviderLogo({ provider }: { provider?: string }) {
  const source = provider ? PROVIDER_LOGOS[provider.toLowerCase()] : undefined;
  if (!source) {
    return null;
  }
  return <Image source={source} w="$5" h="$5" borderRadius="$full" />;
}
