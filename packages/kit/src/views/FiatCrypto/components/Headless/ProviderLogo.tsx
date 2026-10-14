import { Image } from '@onekeyhq/components';

// Slug → display metadata for the headless providers. Logos are official
// marks bundled at 60×60 (rendered 20×20, so ~3× density) and cropped round
// in the UI; sources: Coinbase GitHub org avatar / cdn.paybis.com
// android-chrome icon, fetched 2026-07-17. New wave-2 providers land here
// (one asset + one entry); unknown slugs degrade to a capitalized slug with
// no logo. Backend-served provider metadata is the eventual replacement.
const PROVIDER_META: Record<string, { name: string; logo: number }> = {
  coinbasepay: {
    name: 'Coinbase Pay',
    logo: require('@onekeyhq/kit/assets/onramp_coinbasepay.png'),
  },
  coinbase: {
    name: 'Coinbase',
    logo: require('@onekeyhq/kit/assets/onramp_coinbasepay.png'),
  },
  paybis: {
    name: 'Paybis',
    logo: require('@onekeyhq/kit/assets/onramp_paybis.png'),
  },
};

export function getProviderDisplayName(slug: string): string {
  return (
    PROVIDER_META[slug.toLowerCase()]?.name ??
    slug.charAt(0).toUpperCase() + slug.slice(1)
  );
}

export function ProviderLogo({ provider }: { provider?: string }) {
  const meta = provider ? PROVIDER_META[provider.toLowerCase()] : undefined;
  if (!meta) {
    return null;
  }
  return <Image source={meta.logo} w="$5" h="$5" borderRadius="$full" />;
}
