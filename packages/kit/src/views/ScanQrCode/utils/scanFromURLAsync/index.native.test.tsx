/** @jest-environment jsdom */

import { decodeQrImage } from '@onekeyfe/react-native-qr-scanner';
import { render, screen } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { ScanCamera } from '../../components/ScanCamera/index.native';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeIOSMacCatalyst: true },
}));
jest.mock('@react-navigation/native', () => ({ useNavigation: jest.fn() }));
jest.mock('react-native-nitro-modules', () => ({
  callback: <T,>(fn: T) => fn,
}));
jest.mock('@onekeyfe/react-native-qr-scanner', () => ({
  decodeQrImage: jest.fn(),
  get QrScannerView() {
    throw new OneKeyLocalError('Catalyst must not mount the scanner camera');
  },
}));

const { scanFromURLAsync }: typeof import('./index') = require('./index.ts');

test('Catalyst decodes selected images without mounting the camera', async () => {
  jest.mocked(decodeQrImage).mockResolvedValueOnce('onekey-qr-image');

  await expect(scanFromURLAsync('file:///test-qr.png')).resolves.toBe(
    'onekey-qr-image',
  );
  expect(decodeQrImage).toHaveBeenCalledWith('file:///test-qr.png');

  render(
    <ScanCamera disableNavigationGuard>
      <div>Image selection remains available</div>
    </ScanCamera>,
  );
  expect(screen.getByText('Image selection remains available')).toBeTruthy();
});

test('unreadable images resolve null', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest
    .mocked(decodeQrImage)
    .mockRejectedValueOnce(new OneKeyLocalError('invalid-image'));

  await expect(scanFromURLAsync('file:///broken.png')).resolves.toBeNull();
});
