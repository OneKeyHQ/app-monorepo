/** @jest-environment jsdom */

import { render } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ScanPlugin } from './scan';

const mockStart = jest.fn<Promise<unknown>, [unknown]>();
const mockButton = jest.fn<null, [{ onPress?: () => Promise<void> }]>(
  () => null,
);

jest.mock('@onekeyhq/components', () => ({
  Button: (props: Parameters<typeof mockButton>[0]) => mockButton(props),
  IconButton: (props: Parameters<typeof mockButton>[0]) => mockButton(props),
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock(
  '@onekeyhq/kit/src/views/ScanQrCode/hooks/useScanQrCodeLazy',
  () => () => ({ start: mockStart }),
);

it('keeps the existing Send recipient when the scanner reports an expired invoice', async () => {
  mockStart.mockRejectedValueOnce({
    key: ETranslations.send_the_invoice_has_expired,
  });
  const onChange = jest.fn();
  const onScanResult = jest.fn();
  render(
    <ScanPlugin
      networkId="lightning--0"
      onChange={onChange}
      onScanResult={onScanResult}
    />,
  );
  const [{ onPress }] = mockButton.mock.calls[0];

  await expect(onPress?.()).resolves.toBeUndefined();
  expect(onChange).not.toHaveBeenCalled();
  expect(onScanResult).not.toHaveBeenCalled();
});
