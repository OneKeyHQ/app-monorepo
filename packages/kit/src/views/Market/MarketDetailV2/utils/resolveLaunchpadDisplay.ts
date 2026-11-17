import type { IMarketTokenLaunchpad } from '@onekeyhq/shared/types/marketV2';

// The detail API only returns a protocol id and a logo URL for launchpads. The
// logo file name is the backend `protocolName` (e.g. `.../launchpad/jupStudio.png`),
// so the display name is inferred from it. Keys are lowercased file names.
const LAUNCHPAD_NAME_BY_LOGO_KEY: Record<string, string> = {
  bags: 'Bags',
  bankr: 'Bankr',
  believe: 'Believe',
  bonk: 'Bonk.fun',
  bonkers: 'Bonkers',
  clanker: 'Clanker',
  dyorfun: 'DYOR.fun',
  dyorfunvthree: 'DYOR.fun V3',
  flap: 'Flap',
  fourmeme: 'Four.meme',
  jupstudio: 'Jup Studio',
  launchlab: 'LaunchLab',
  longxyz: 'Long.xyz',
  mayhem: 'Mayhem',
  meteoradbc: 'Meteora DBC',
  moonshot: 'Moonshot',
  moonshotmoney: 'Moonshot Money',
  ooneexchange: 'O1 Exchange',
  pons: 'PONS',
  ponsvtwo: 'PONS V2',
  poolsfun: 'Pools.fun',
  poolstrade: 'Pools.trade',
  pumpfun: 'Pump.fun',
  sunpump: 'SunPump',
};

function getLogoFileKey(logoUrl: string) {
  const path = logoUrl.split(/[?#]/)[0] ?? '';
  const fileName = path.split('/').pop() ?? '';
  return fileName.replace(/\.[^.]+$/, '').trim();
}

export function resolveLaunchpadDisplay(
  launchpad: IMarketTokenLaunchpad | null | undefined,
): { name: string; logoUrl: string } | undefined {
  const logoUrl = launchpad?.logoUrl?.trim();
  if (!logoUrl) {
    return undefined;
  }
  const fileKey = getLogoFileKey(logoUrl);
  if (!fileKey) {
    return undefined;
  }
  const name =
    LAUNCHPAD_NAME_BY_LOGO_KEY[fileKey.toLowerCase()] ??
    `${fileKey.charAt(0).toUpperCase()}${fileKey.slice(1)}`;
  return { name, logoUrl };
}
