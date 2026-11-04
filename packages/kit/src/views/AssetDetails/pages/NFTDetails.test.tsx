/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { act, render, screen } from '@testing-library/react';

import { ImageCrop, Toast } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import imageUtils from '@onekeyhq/shared/src/utils/imageUtils';

import NFTDetails from './NFTDetails';

const mockCleanup = jest.fn(async () => {});
const mockUploadNFT = jest.fn(async () => {});
let mockCollectNFT: (close: () => void) => Promise<void>;

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@react-navigation/core', () => ({
  useRoute: () => ({
    params: { networkId: 'evm--1', accountId: 'account-test' },
  }),
}));
jest.mock('@onekeyhq/components', () => {
  const Container = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Page: Object.assign(Container, {
      Header: ({ headerRight }: { headerRight?: () => ReactNode }) =>
        headerRight?.(),
      Body: Container,
    }),
    Stack: Container,
    Button: Container,
    HeaderIconButton: () => null,
    ActionList: ({
      items,
    }: {
      items: { onPress: (close: () => void) => Promise<void> }[];
    }) => {
      const [item] = items;
      if (item) mockCollectNFT = item.onPress;
      return <div data-testid="collect-action" />;
    },
    Spinner: () => <div data-testid="collecting" />,
    ImageCrop: { openCropImage: jest.fn() },
    Toast: { error: jest.fn(), success: jest.fn() },
  };
});
jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({}),
}));
jest.mock('../../../hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({
    result: {
      network: { name: 'Ethereum' },
      nft: { amount: '1', metadata: { image: 'https://nft.test/image.png' } },
      device: { id: 'device-test', deviceType: 'touch' },
    },
    isLoading: false,
  }),
}));
jest.mock('../../../utils/getNFTDetailsComponents', () => ({
  getNFTDetailsComponents: () => ({
    ImageContent: () => null,
    DetailContent: () => null,
  }),
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHardware: {
      getDeviceNftConfig: async () => ({ size: { width: 144, height: 144 } }),
    },
    serviceNFT: { uploadNFTImageToDevice: () => mockUploadNFT() },
  },
}));
jest.mock('@onekeyhq/shared/src/errors', () => ({
  OneKeyAppError: class extends Error {},
}));
jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: { showToastOfError: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isWeb: false },
}));
jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({}));
jest.mock('@onekeyhq/shared/src/utils/deviceHomeScreenUtils', () => ({}));
jest.mock('@onekeyhq/shared/src/utils/hardwareDeviceTypes', () => ({
  isProtocolV2ProductType: () => false,
}));
jest.mock('@onekeyhq/shared/src/utils/imageUtils', () => ({
  __esModule: true,
  default: {
    prepareImageForCropWithInfo: async () => ({
      uri: 'prepared-image.png',
      cleanup: mockCleanup,
    }),
    resizeImage: jest.fn(),
  },
}));
jest.mock('@onekeyhq/shared/src/utils/nftUtils', () => ({
  isCollectNFTDeviceCompatible: () => true,
}));
jest.mock('@onekeyhq/shared/src/utils/stringUtils', () => ({
  __esModule: true,
  default: { capitalizeWords: (value: string) => value },
}));

beforeEach(() => jest.clearAllMocks());

it.each([
  { error: { code: 'E_PICKER_CANCELLED' }, cancelled: true },
  { error: new Error('Crop failed'), cancelled: false },
])(
  'handles crop failure with cancelled=$cancelled',
  async ({ error, cancelled }) => {
    jest.mocked(ImageCrop.openCropImage).mockRejectedValueOnce(error);
    render(<NFTDetails />);
    expect(screen.getByTestId('collect-action')).toBeTruthy();

    await act(async () => {
      await expect(mockCollectNFT(jest.fn())).resolves.toBeUndefined();
    });

    expect(mockCleanup).toHaveBeenCalledTimes(1);
    expect(imageUtils.resizeImage).not.toHaveBeenCalled();
    expect(mockUploadNFT).not.toHaveBeenCalled();
    expect(screen.queryByTestId('collecting')).toBeNull();
    expect(screen.getByTestId('collect-action')).toBeTruthy();
    if (cancelled) {
      expect(Toast.error).not.toHaveBeenCalled();
    } else {
      expect(Toast.error).toHaveBeenCalledWith({
        title: ETranslations.global_unknown_error,
      });
    }
  },
);
