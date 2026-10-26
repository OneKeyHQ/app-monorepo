import { resolveLaunchpadDisplay } from './resolveLaunchpadDisplay';

const logoUrl = (fileName: string) =>
  `https://uni.onekey-asset.com/static/utility/okx/launchpad/${fileName}`;

describe('resolveLaunchpadDisplay', () => {
  // Every `protocolName` the backend currently returns for launchpads.
  it.each([
    ['bags', 'Bags'],
    ['bankr', 'Bankr'],
    ['believe', 'Believe'],
    ['bonk', 'Bonk.fun'],
    ['bonkers', 'Bonkers'],
    ['clanker', 'Clanker'],
    ['dyorfun', 'DYOR.fun'],
    ['dyorfunvthree', 'DYOR.fun V3'],
    ['flap', 'Flap'],
    ['fourmeme', 'Four.meme'],
    ['jupStudio', 'Jup Studio'],
    ['launchlab', 'LaunchLab'],
    ['longxyz', 'Long.xyz'],
    ['mayhem', 'Mayhem'],
    ['meteoradbc', 'Meteora DBC'],
    ['moonshot', 'Moonshot'],
    ['moonshotMoney', 'Moonshot Money'],
    ['ooneexchange', 'O1 Exchange'],
    ['pons', 'PONS'],
    ['ponsvtwo', 'PONS V2'],
    ['poolsfun', 'Pools.fun'],
    ['poolstrade', 'Pools.trade'],
    ['pumpfun', 'Pump.fun'],
    ['sunpump', 'SunPump'],
  ])('infers the name from %s.png', (protocolName, name) => {
    const url = logoUrl(`${protocolName}.png`);
    expect(
      resolveLaunchpadDisplay({
        protocolId: '120596',
        logoUrl: url,
        isInternal: false,
        progress: '',
      }),
    ).toEqual({ name, logoUrl: url });
  });

  it('ignores query strings and letter case in the file name', () => {
    expect(
      resolveLaunchpadDisplay({ logoUrl: logoUrl('PumpFun.PNG?v=2') })?.name,
    ).toBe('Pump.fun');
  });

  it('capitalizes the file name for launchpads without a known name', () => {
    expect(
      resolveLaunchpadDisplay({ logoUrl: logoUrl('newLaunchpad.png') })?.name,
    ).toBe('NewLaunchpad');
  });

  it('hides the launchpad when the API returns nothing usable', () => {
    expect(resolveLaunchpadDisplay(undefined)).toBeUndefined();
    expect(resolveLaunchpadDisplay(null)).toBeUndefined();
    expect(resolveLaunchpadDisplay({ protocolId: '120596' })).toBeUndefined();
    expect(resolveLaunchpadDisplay({ logoUrl: '  ' })).toBeUndefined();
    expect(
      resolveLaunchpadDisplay({ logoUrl: 'https://example.com/launchpad/' }),
    ).toBeUndefined();
  });
});
