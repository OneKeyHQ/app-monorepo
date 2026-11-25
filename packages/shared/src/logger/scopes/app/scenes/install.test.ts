/* cspell:ignore gbraid gclid wbraid */
import { InstallScene } from './install';

describe('install attribution diagnostics', () => {
  it('sends Google Ads click identifiers to analytics only', async () => {
    const scene = new InstallScene();
    const emit = jest.spyOn(scene, '_emitLog').mockResolvedValue(undefined);
    const params = {
      gadSource: '1',
      gbraid: 'google-braid',
      gclid: 'google-click',
      utmSource: 'onekey.so',
      wbraid: 'web-braid',
    };

    await scene.reportGooglePlayInstallAttribution(params);

    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenCalledWith(
      'installAttributionDiagnostic',
      [{ gadSource: '1', utmSource: 'onekey.so' }],
      [expect.objectContaining({ type: 'local' })],
    );
    expect(emit).toHaveBeenCalledWith(
      'installAttribution',
      [params],
      [expect.objectContaining({ type: 'server' })],
    );
  });
});
