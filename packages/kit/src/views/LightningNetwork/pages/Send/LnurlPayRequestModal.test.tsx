/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { act, cleanup, render } from '@testing-library/react';

import type { ILNURLPayServiceResponse } from '@onekeyhq/shared/types/lightning';

import LnurlPayRequestModal from './LnurlPayRequestModal';

type IOnConfirm = (
  close?: (extra?: { flag?: string }) => void,
) => Promise<void>;

const lnurlDetails = {
  tag: 'payRequest',
  callback: 'https://service.example/pay/callback',
  minSendable: 1000,
  maxSendable: 1_000_000,
  metadata: '[["text/plain","coffee"]]',
  domain: 'service.example',
  url: 'https://service.example/pay',
} as unknown as ILNURLPayServiceResponse;

const mockFetchPayResult = jest.fn<Promise<{ pr: string }>, [unknown]>();
const mockVerifyInvoice = jest.fn<Promise<boolean>, [unknown]>();
const mockNormalizeTxConfirm = jest.fn<Promise<void>, [unknown]>();
const mockToastError = jest.fn<void, [unknown]>();
const mockFormBounds: Array<[number?, number?]> = [];
const mockState: {
  routeParams: Record<string, unknown>;
  onConfirm?: IOnConfirm;
} = { routeParams: {} };

jest.mock('@react-navigation/core', () => ({
  useRoute: () => ({ params: mockState.routeParams }),
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
// One factory serves both the bare package import and the
// '@onekeyhq/components/src/hooks/useForm' subpath import.
jest.mock('@onekeyhq/components', () => {
  const passThrough = ({ children }: { children?: ReactNode }) =>
    children ?? null;
  return {
    Page: Object.assign(passThrough, {
      Header: () => null,
      Body: passThrough,
      Footer: passThrough,
    }),
    Toast: { error: (params: unknown) => mockToastError(params) },
    useForm: () => ({
      trigger: async () => true,
      getValues: () => ({ amount: '100' }),
      watch: () => '100',
    }),
  };
});
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceLightning: {
      fetchLnurlPayRequestResult: (params: unknown) =>
        mockFetchPayResult(params),
      verifyInvoice: (params: unknown) => mockVerifyInvoice(params),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => ({
  useSignatureConfirm: () => ({
    normalizeTxConfirm: (params: unknown) => mockNormalizeTxConfirm(params),
  }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useDappApproveAction', () => ({
  __esModule: true,
  default: () => ({ resolve: jest.fn(), reject: jest.fn() }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useDappQuery', () => ({
  __esModule: true,
  default: () => ({}),
}));
jest.mock(
  '@onekeyhq/kit/src/views/DAppConnection/pages/DappOpenModalPage',
  () => ({
    __esModule: true,
    default: ({ children }: { children?: ReactNode }) => children,
  }),
);
jest.mock('../../../DAppConnection/components/DAppAccountList', () => ({
  DAppAccountListStandAloneItem: () => null,
  DAppAccountListStandAloneItemReadonly: () => null,
}));
jest.mock('../../../DAppConnection/components/DAppRequestLayout', () => ({
  DAppRequestLayout: ({ children }: { children?: ReactNode }) => children,
  DAppRequestFooter: ({ onConfirm }: { onConfirm: IOnConfirm }) => {
    mockState.onConfirm = onConfirm;
    return null;
  },
}));
jest.mock('../../../DAppConnection/hooks/useRiskDetection', () => ({
  useRiskDetection: () => ({
    showContinueOperate: false,
    continueOperate: true,
    setContinueOperate: () => undefined,
    riskLevel: 'safe',
    urlSecurityInfo: undefined,
  }),
}));
jest.mock('../../components/LNSendPaymentForm', () => ({
  __esModule: true,
  default: (props: { minimumAmount?: number; maximumAmount?: number }) => {
    mockFormBounds.push([props.minimumAmount, props.maximumAmount]);
    return null;
  },
}));

async function confirmPay(networkId: string) {
  mockState.routeParams = {
    isSendFlow: true,
    accountId: 'account-1',
    networkId,
    lnurlDetails,
    transfersInfo: [{ from: 'from', to: 'alice@service.example', amount: '0' }],
  };
  render(<LnurlPayRequestModal />);
  await act(async () => {
    await mockState.onConfirm?.();
  });
}

describe('LnurlPayRequestModal invoice verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.onConfirm = undefined;
    mockFetchPayResult.mockResolvedValue({ pr: 'lnbc1invoice' });
    mockNormalizeTxConfirm.mockResolvedValue(undefined);
  });
  afterEach(cleanup);

  it('stops a self-custody payment when the invoice does not match the request', async () => {
    mockVerifyInvoice.mockResolvedValue(false);

    await confirmPay('lightningspark--0');

    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(mockNormalizeTxConfirm).not.toHaveBeenCalled();
  });

  it('confirms a self-custody payment whose invoice matches the request', async () => {
    mockVerifyInvoice.mockResolvedValue(true);

    await confirmPay('lightningspark--0');

    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockNormalizeTxConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        transfersInfo: [
          expect.objectContaining({
            to: 'lnbc1invoice',
            lightningAddress: 'alice@service.example',
          }),
        ],
      }),
    );
  });

  it('leaves custodial Lightning as it was: it warns and still confirms', async () => {
    mockVerifyInvoice.mockResolvedValue(false);

    await confirmPay('lightning--0');

    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(mockNormalizeTxConfirm).toHaveBeenCalledTimes(1);
  });

  it('bounds the amount by the whole sats inside the range of the request', () => {
    mockState.routeParams = {
      isSendFlow: true,
      accountId: 'account-1',
      networkId: 'lightningspark--0',
      lnurlDetails: { ...lnurlDetails, minSendable: 1501, maxSendable: 9000 },
      transfersInfo: [{ from: 'from', to: 'a@service.example', amount: '0' }],
    };

    render(<LnurlPayRequestModal />);

    // 1 sat is 1000 thousandths, below the minimum of 1501.
    expect(mockFormBounds.at(-1)).toEqual([2, 9]);
  });

  it('leaves the custodial bounds as they were', () => {
    mockState.routeParams = {
      isSendFlow: true,
      accountId: 'account-1',
      networkId: 'lightning--0',
      lnurlDetails: { ...lnurlDetails, minSendable: 1501, maxSendable: 9000 },
      transfersInfo: [{ from: 'from', to: 'a@service.example', amount: '0' }],
    };

    render(<LnurlPayRequestModal />);

    expect(mockFormBounds.at(-1)).toEqual([1, 9]);
  });
});
