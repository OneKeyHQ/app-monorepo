/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { Camera } from 'expo-camera';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { ScanCamera } from '../../components/ScanCamera/index.native';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeIOSMacCatalyst: true },
}));
jest.mock('@onekeyhq/components', () => ({ usePreventRemove: jest.fn() }));
jest.mock('@react-navigation/native', () => ({ useNavigation: jest.fn() }));
jest.mock('react-native-camera-kit', () => {
  throw new OneKeyLocalError('Catalyst must not initialize camera capture');
});
jest.mock('expo-camera', () => ({
  Camera: { scanFromURLAsync: jest.fn() },
}));

const { scanFromURLAsync }: typeof import('./index') = require('./index.ts');

test('Catalyst decodes selected images without loading camera capture', async () => {
  jest.mocked(Camera.scanFromURLAsync).mockResolvedValueOnce([
    {
      data: 'onekey-qr-image',
      type: 'qr',
      cornerPoints: [],
      bounds: { origin: { x: 0, y: 0 }, size: { width: 100, height: 100 } },
    },
  ]);

  await expect(scanFromURLAsync('file:///test-qr.png')).resolves.toBe(
    'onekey-qr-image',
  );
  expect(Camera.scanFromURLAsync).toHaveBeenCalledWith('file:///test-qr.png');

  render(
    <ScanCamera disableNavigationGuard>
      <div>Image selection remains available</div>
    </ScanCamera>,
  );
  expect(screen.getByText('Image selection remains available')).toBeTruthy();
});
