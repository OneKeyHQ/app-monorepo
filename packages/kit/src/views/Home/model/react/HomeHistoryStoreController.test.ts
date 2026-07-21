import fs from 'fs';
import path from 'path';

import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

import {
  createHomeHistoryStoreResult,
  runHomeHistoryStoreRequest,
} from '../sections/history/homeHistoryControllerUtils';
import { createHomeHistoryStorePayload } from '../sections/history/homeHistoryStoreModel';

import type { IHomeSectionSourceRequestHandle } from './useHomeStoreSourcePublisher';

const handle = {
  payload: {
    ownerToken: { scopeKey: 'owner-a', sessionId: 'session-a' },
    sectionId: 'history',
  },
  token: {
    protocolVersion: 1,
    clientInstanceId: 'client-a',
    producerInstanceId: 'producer-a',
    sessionId: 'session-a',
    requestSeq: 1,
    sourceKey: {
      scopeKey: 'owner-a',
      sourceId: 'history',
      paramsFingerprint: 'history-a',
      dataSchemaVersion: 1,
    },
  },
} satisfies IHomeSectionSourceRequestHandle;

const history = {
  id: 'history-a',
  decodedTx: { status: 'confirmed' },
} as unknown as IAccountHistoryTx;

const controllerSource = fs.readFileSync(
  path.join(__dirname, 'HomeHistoryStoreController.tsx'),
  'utf8',
);

describe('HomeHistoryStoreController', () => {
  it('opens the Store request before the real source await and completes the same handle', async () => {
    const order: string[] = [];
    const completedHandles: IHomeSectionSourceRequestHandle[] = [];

    await runHomeHistoryStoreRequest({
      gateway: {
        begin: () => {
          order.push('begin');
          return handle;
        },
        complete: (requestHandle) => {
          order.push('complete');
          completedHandles.push(requestHandle);
        },
      },
      isCurrent: () => true,
      load: async () => {
        order.push('load');
        return { txs: [history] };
      },
      project: (response) => {
        order.push('project');
        return createHomeHistoryStorePayload({ data: response.txs });
      },
    });

    expect(order).toEqual(['begin', 'load', 'project', 'complete']);
    expect(completedHandles).toEqual([handle]);
  });

  it('rejects stale completion before projection and runs no downstream side effect', async () => {
    let current = true;
    const complete = jest.fn();
    const project = jest.fn(() =>
      createHomeHistoryStorePayload({ data: [history] }),
    );
    const afterSuccess = jest.fn();

    const result = await runHomeHistoryStoreRequest({
      gateway: { begin: () => handle, complete },
      isCurrent: () => current,
      load: async () => {
        current = false;
        return { txs: [history] };
      },
      project,
      afterSuccess,
    });

    expect(result.accepted).toBe(false);
    expect(project).not.toHaveBeenCalled();
    expect(afterSuccess).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith(handle, { kind: 'error' });
  });

  it('runs downstream token/DeFi/cache work once for one accepted response', async () => {
    const afterSuccess = jest.fn();
    await runHomeHistoryStoreRequest({
      gateway: { begin: () => handle, complete: jest.fn() },
      isCurrent: () => true,
      load: async () => ({ txs: [history] }),
      project: (response) =>
        createHomeHistoryStorePayload({ data: response.txs }),
      afterSuccess,
    });

    expect(afterSuccess).toHaveBeenCalledTimes(1);
  });

  it('keeps an empty History display payload self-contained in the Store', () => {
    expect(
      createHomeHistoryStoreResult(
        createHomeHistoryStorePayload({
          addressMap: {
            'evm--1:0x1': { label: 'Alice', type: 'default' },
          },
          data: [],
          tokenMap: {
            'evm--1:token': {
              balance: '1',
              balanceParsed: '1',
              fiatValue: '1',
              price: 1,
            },
          },
        }),
      ),
    ).toMatchObject({
      kind: 'ready',
      rowIds: [],
      data: {
        addressMap: {
          'evm--1:0x1': { label: 'Alice', type: 'default' },
        },
        data: [],
        tokenMap: {
          'evm--1:token': {
            balance: '1',
            balanceParsed: '1',
            fiatValue: '1',
            price: 1,
          },
        },
      },
    });
  });

  it('owns cache, polling, events, pagination and explicit request lifecycle outside the renderer', () => {
    expect(controllerSource).toContain('getAccountsLocalHistoryTxs');
    expect(controllerSource).toContain('getLocalAddressesInfo');
    expect(controllerSource).toContain('fetchAccountHistory');
    expect(controllerSource).toContain('fetchAccountHistoryForMergeDerive');
    expect(controllerSource).toContain('POLLING_INTERVAL_FOR_HISTORY');
    expect(controllerSource).toContain('HistoryTxStatusChanged');
    expect(controllerSource).toContain('beginHomeSectionRequest');
    expect(controllerSource).toContain('completeHomeSectionRequest');
    expect(controllerSource).toContain('loadMoreInFlightRef.current');
    expect(controllerSource).toContain('pendingSectionCommands.find');
    expect(controllerSource).toContain('tokenMap: tokenMapRef.current');
    expect(controllerSource).toContain("useHomeSectionPayload('portfolio')");
    expect(controllerSource).not.toContain('useHomeTokenListSnapshot');
  });
});
