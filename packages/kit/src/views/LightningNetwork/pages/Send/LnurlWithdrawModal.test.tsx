/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { act, cleanup, render } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EDAppModalPageStatus } from '@onekeyhq/shared/types/dappConnection';
import type { ILNURLWithdrawServiceResponse } from '@onekeyhq/shared/types/lightning';

import LnurlWithdrawModal from './LnurlWithdrawModal';

type IClose = (extra?: { flag?: string }) => void;
type IOnConfirm = (close?: IClose, closePageStack?: IClose) => Promise<void>;
type IRouteParams = {
  isSendFlow?: boolean;
  accountId?: string;
  networkId?: string;
  lnurlDetails?: ILNURLWithdrawServiceResponse;
};

const lnurlDetails: ILNURLWithdrawServiceResponse = {
  tag: 'withdrawRequest',
  callback: 'https://service.example/withdraw/callback',
  k1: 'k1-value',
  defaultDescription: 'gift',
  minWithdrawable: 100_000,
  maxWithdrawable: 100_000,
  domain: 'service.example',
  url: 'https://service.example/withdraw',
};

const mockCreateInvoice = jest.fn<
  Promise<{ payment_request: string }>,
  [unknown]
>();
const mockFetchWithdrawResult = jest.fn<Promise<void>, [unknown]>();
const mockToastSuccess = jest.fn<void, [unknown]>();
const mockDappResolve = jest.fn<Promise<void>, [unknown?]>();
const mockDappReject = jest.fn<void, []>();
const mockFormBounds: Array<[number?, number?]> = [];
const mockState: {
  routeParams: IRouteParams;
  dappQuery: IRouteParams & { $sourceInfo?: { id: string } };
  onConfirm?: IOnConfirm;
} = { routeParams: {}, dappQuery: {} };

jest.mock('@react-navigation/core', () => ({
  useRoute: () => ({ params: mockState.routeParams }),
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
// One factory serves both the bare package import and the
// '@onekeyhq/components/src/hooks/useForm' subpath import: the repo-wide
// moduleNameMapper collapses every '@onekeyhq/components*' specifier into the
// same mocked module.
jest.mock('@onekeyhq/components', () => {
  const passThrough = ({ children }: { children?: ReactNode }) =>
    children ?? null;
  return {
    Page: Object.assign(passThrough, {
      Header: () => null,
      Body: passThrough,
      Footer: passThrough,
    }),
    Toast: { success: (params: unknown) => mockToastSuccess(params) },
    useForm: () => ({
      trigger: async () => true,
      getValues: () => ({ amount: '100' }),
    }),
  };
});
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceLightning: {
      createInvoice: (params: unknown) => mockCreateInvoice(params),
      fetchLnurlWithdrawRequestResult: (params: unknown) =>
        mockFetchWithdrawResult(params),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useDappApproveAction', () => ({
  __esModule: true,
  default: () => ({
    resolve: (params?: unknown) => mockDappResolve(params),
    reject: () => mockDappReject(),
  }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useDappQuery', () => ({
  __esModule: true,
  default: () => mockState.dappQuery,
}));
jest.mock('@onekeyhq/kit/src/hooks/useLightningSparkSession', () => ({
  useLightningSparkSession: () => undefined,
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
jest.mock('../../components/LNMakeInvoiceForm', () => ({
  __esModule: true,
  default: (props: { minimumAmount?: number; maximumAmount?: number }) => {
    mockFormBounds.push([props.minimumAmount, props.maximumAmount]);
    return null;
  },
}));

const confirmed = { flag: EDAppModalPageStatus.Confirmed };

async function confirmWithdraw() {
  const close = jest.fn<void, [{ flag?: string }?]>();
  const closePageStack = jest.fn<void, [{ flag?: string }?]>();
  render(<LnurlWithdrawModal />);
  let error: unknown;
  await act(async () => {
    try {
      await mockState.onConfirm?.(close, closePageStack);
    } catch (e) {
      error = e;
    }
  });
  return { close, closePageStack, error };
}

describe('LnurlWithdrawModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.onConfirm = undefined;
    mockCreateInvoice.mockResolvedValue({ payment_request: 'lnbc1invoice' });
    mockFetchWithdrawResult.mockResolvedValue(undefined);
    mockDappResolve.mockResolvedValue(undefined);
  });
  afterEach(cleanup);

  it('closes the whole Send flow after a withdraw from the Send page', async () => {
    mockState.routeParams = {
      isSendFlow: true,
      accountId: 'account-1',
      networkId: 'lightningspark--0',
      lnurlDetails,
    };
    mockState.dappQuery = {};

    const { close, closePageStack, error } = await confirmWithdraw();

    expect(error).toBeUndefined();
    expect(mockCreateInvoice).toHaveBeenCalledWith({
      networkId: 'lightningspark--0',
      accountId: 'account-1',
      amount: '100',
      description: 'gift',
    });
    expect(mockFetchWithdrawResult).toHaveBeenCalledWith({
      callback: lnurlDetails.callback,
      k1: lnurlDetails.k1,
      pr: 'lnbc1invoice',
    });
    expect(mockToastSuccess).toHaveBeenCalledTimes(1);
    expect(closePageStack).toHaveBeenCalledTimes(1);
    expect(closePageStack).toHaveBeenCalledWith(confirmed);
    expect(close).not.toHaveBeenCalled();
    expect(mockDappResolve).not.toHaveBeenCalled();
  });

  it('closes only its own page after a withdraw requested by a dApp', async () => {
    mockState.routeParams = { isSendFlow: false };
    mockState.dappQuery = {
      $sourceInfo: { id: 'request-1' },
      accountId: 'account-1',
      networkId: 'lightning--0',
      lnurlDetails,
    };

    const { close, closePageStack, error } = await confirmWithdraw();

    expect(error).toBeUndefined();
    expect(mockDappResolve).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledWith(confirmed);
    expect(closePageStack).not.toHaveBeenCalled();
  });

  it('keeps the page open when the service rejects the withdraw', async () => {
    mockState.routeParams = {
      isSendFlow: true,
      accountId: 'account-1',
      networkId: 'lightningspark--0',
      lnurlDetails,
    };
    mockState.dappQuery = {};
    mockFetchWithdrawResult.mockRejectedValue(
      new OneKeyLocalError('Link already used'),
    );

    const { close, closePageStack, error } = await confirmWithdraw();

    expect((error as Error).message).toBe('Link already used');
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(closePageStack).not.toHaveBeenCalled();
  });

  it('bounds the amount by the whole sats inside the range of the request', () => {
    mockState.routeParams = {
      isSendFlow: true,
      accountId: 'account-1',
      networkId: 'lightningspark--0',
      lnurlDetails: {
        ...lnurlDetails,
        minWithdrawable: 1501,
        maxWithdrawable: 9000,
      },
    };

    render(<LnurlWithdrawModal />);

    // 1 sat is 1000 thousandths, below the minimum of 1501.
    expect(mockFormBounds.at(-1)).toEqual([2, 9]);
  });
});
