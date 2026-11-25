/** @jest-environment jsdom */
import { render } from '@testing-library/react';
import { IntlProvider } from 'react-intl';

import TxConfirmExtraInfo from '../TxConfirmExtraInfo';

jest.mock('../ExtraInfoTron', () => () => null);
jest.mock('../../SignatureConfirmItem', () => ({
  SignatureConfirmItem: Object.assign(
    ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    { Label: 'span', Value: 'strong' },
  ),
}));
const mockUseAccountData = jest.fn(() => ({
  network: { impl: 'starknet', decimals: 18, symbol: 'STRK' },
}));
jest.mock('@onekeyhq/kit/src/hooks/useAccountData', () => ({
  useAccountData: () => mockUseAccountData(),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm', () => ({
  useDecodedTxsAtom: () => [
    { decodedTxs: [{ extraInfo: { deployAccountFee: '10000000000000000' } }] },
  ],
  useSendSelectedFeeInfoAtom: () => [undefined],
}));

it('formats the activation fee on its first render using the resolved network', () => {
  const ui = render(
    <IntlProvider locale="en">
      <TxConfirmExtraInfo
        accountId="account"
        networkId="starknet--mainnet"
        unsignedTxs={[]}
      />
    </IntlProvider>,
  );
  expect(mockUseAccountData).toHaveBeenCalledTimes(1);
  expect(ui.getByText('0.01 STRK')).toBeTruthy();
});
