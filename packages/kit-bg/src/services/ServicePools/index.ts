import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IPoolDetail,
  IPoolExitParams,
  IPoolListItem,
  IPoolListQuery,
  IPoolPricePoint,
  IPoolPriceRange,
  IPoolRemovePreview,
  IPoolTask,
  IPoolTaskRequest,
  IPoolTopPositionsPage,
  IPoolTopPositionsSortKey,
  IPoolZapInPlan,
  IPoolZapInPlanParams,
  IPoolsDemoSettings,
  IPoolsPortfolio,
  IPoolsWallet,
} from '@onekeyhq/shared/types/pools';

import ServiceBase from '../ServiceBase';

import {
  POOLS_DEMO_STATE_VERSION,
  abandonTask,
  buildPortfolio,
  buildWallet,
  createInitialDemoState,
  createTask,
  findPoolsByKey,
  getFavoritePoolIds,
  getPoolDetail,
  getPoolNetworkIds,
  getPoolPriceHistory,
  getPoolTopPositions,
  getTask,
  planZapIn,
  previewRemove,
  queryPools,
  setPoolFavorite,
  settleTaskStep,
  stopTask,
  submitTaskStep,
} from './poolsDemoEngine';
import { buildMockCatalog } from './poolsMockBuilder';

import type { IPoolsMockCatalog } from './poolsMockBuilder';
import type { IPoolsDemoDBStruct } from '../../dbs/simple/entity/SimpleDbEntityPoolsDemo';

// Pools (Uniswap LP) demo service. Pool data is a fixed snapshot, positions
// and balances are mock state, and transactions are simulated step by step;
// all amounts come from the real Uniswap math in shared/utils/poolsMath.

// How long a simulated transaction takes to land
const MOCK_CONFIRMATION_MS = 1400;

@backgroundClass()
class ServicePools extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  private catalog: IPoolsMockCatalog | undefined;

  private getCatalog() {
    if (!this.catalog) {
      this.catalog = buildMockCatalog(Date.now());
    }
    return this.catalog;
  }

  private isCurrentState(
    raw: IPoolsDemoDBStruct | null | undefined,
  ): raw is IPoolsDemoDBStruct {
    return raw?.version === POOLS_DEMO_STATE_VERSION;
  }

  private async getState(): Promise<IPoolsDemoDBStruct> {
    const raw = await this.backgroundApi.simpleDb.poolsDemo.getRawData();
    if (this.isCurrentState(raw)) {
      return raw;
    }
    return this.updateState((state) => state);
  }

  /** Read-modify-write under the entity mutex */
  private async updateState<T>(
    mutate: (state: IPoolsDemoDBStruct) => T | Promise<T>,
  ): Promise<IPoolsDemoDBStruct & { result?: T }> {
    let result: T | undefined;
    const saved = await this.backgroundApi.simpleDb.poolsDemo.setRawData(
      async (raw) => {
        const state = this.isCurrentState(raw)
          ? raw
          : createInitialDemoState(this.getCatalog(), Date.now());
        result = await mutate(state);
        return state;
      },
    );
    if (!saved) {
      throw new OneKeyLocalError('Pools demo state was not saved');
    }
    return { ...saved, result };
  }

  @backgroundMethod()
  async getPoolNetworkIds(): Promise<string[]> {
    return getPoolNetworkIds(this.getCatalog());
  }

  @backgroundMethod()
  async getPoolList(query?: IPoolListQuery): Promise<IPoolListItem[]> {
    return queryPools(this.getCatalog(), query);
  }

  /** A pool by its exact address or V4 pool ID, also one the list leaves out */
  @backgroundMethod()
  async findPoolsByKey({
    poolKey,
  }: {
    poolKey: string;
  }): Promise<IPoolListItem[]> {
    return findPoolsByKey(this.getCatalog(), poolKey);
  }

  @backgroundMethod()
  async getPoolDetail({ poolId }: { poolId: string }): Promise<IPoolDetail> {
    return getPoolDetail(this.getCatalog(), poolId);
  }

  @backgroundMethod()
  async getPoolPriceHistory({
    poolId,
    range,
  }: {
    poolId: string;
    range: IPoolPriceRange;
  }): Promise<IPoolPricePoint[]> {
    return getPoolPriceHistory(this.getCatalog(), poolId, range);
  }

  @backgroundMethod()
  async getPoolTopPositions({
    poolId,
    offset,
    limit,
    sortBy,
  }: {
    poolId: string;
    offset?: number;
    limit?: number;
    sortBy?: IPoolTopPositionsSortKey;
  }): Promise<IPoolTopPositionsPage> {
    return getPoolTopPositions(this.getCatalog(), poolId, {
      offset,
      limit,
      sortBy,
    });
  }

  @backgroundMethod()
  async getFavoritePoolIds(): Promise<string[]> {
    return getFavoritePoolIds(await this.getState());
  }

  @backgroundMethod()
  async setPoolFavorite({
    poolId,
    favorite,
  }: {
    poolId: string;
    favorite: boolean;
  }): Promise<string[]> {
    const { result } = await this.updateState((state) =>
      setPoolFavorite(state, poolId, favorite),
    );
    return result ?? [];
  }

  @backgroundMethod()
  async getPortfolio(): Promise<IPoolsPortfolio> {
    return buildPortfolio(this.getCatalog(), await this.getState());
  }

  @backgroundMethod()
  async getWallet({ networkId }: { networkId: string }): Promise<IPoolsWallet> {
    return buildWallet(this.getCatalog(), await this.getState(), networkId);
  }

  @backgroundMethod()
  async planZapIn(params: IPoolZapInPlanParams): Promise<IPoolZapInPlan> {
    return planZapIn(this.getCatalog(), params);
  }

  @backgroundMethod()
  async previewRemove(
    params: Omit<IPoolExitParams, 'targetAssetId'> & {
      targetAssetId?: string;
    },
  ): Promise<IPoolRemovePreview> {
    return previewRemove(this.getCatalog(), await this.getState(), params);
  }

  @backgroundMethod()
  async createTask(request: IPoolTaskRequest): Promise<IPoolTask> {
    const { result } = await this.updateState((state) =>
      createTask(this.getCatalog(), state, request, Date.now()),
    );
    if (!result) {
      throw new OneKeyLocalError('Pools task was not created');
    }
    return result;
  }

  @backgroundMethod()
  async getTask({ taskId }: { taskId: string }): Promise<IPoolTask> {
    return getTask(await this.getState(), taskId);
  }

  /** Sends the next step, waits for the mock chain, then lands it */
  @backgroundMethod()
  async runTaskStep({ taskId }: { taskId: string }): Promise<IPoolTask> {
    await this.updateState((state) =>
      submitTaskStep(state, taskId, Date.now()),
    );
    await timerUtils.wait(MOCK_CONFIRMATION_MS);
    const { result } = await this.updateState((state) =>
      settleTaskStep(this.getCatalog(), state, taskId, Date.now()),
    );
    if (!result) {
      throw new OneKeyLocalError('Pools task step was not saved');
    }
    return result;
  }

  @backgroundMethod()
  async stopTask({ taskId }: { taskId: string }): Promise<void> {
    await this.updateState((state) => stopTask(state, taskId, Date.now()));
  }

  @backgroundMethod()
  async abandonTask({ taskId }: { taskId: string }): Promise<void> {
    await this.updateState((state) => abandonTask(state, taskId, Date.now()));
  }

  @backgroundMethod()
  async getDemoSettings(): Promise<IPoolsDemoSettings> {
    const state = await this.getState();
    return { failNextStep: state.failNextStep };
  }

  @backgroundMethod()
  async setDemoSettings(settings: Partial<IPoolsDemoSettings>): Promise<void> {
    await this.updateState((state) => {
      if (settings.failNextStep !== undefined) {
        state.failNextStep = settings.failNextStep;
      }
    });
  }

  @backgroundMethod()
  async resetDemo(): Promise<void> {
    const favorites = getFavoritePoolIds(await this.getState());
    await this.backgroundApi.simpleDb.poolsDemo.setRawData(
      createInitialDemoState(this.getCatalog(), Date.now(), favorites),
    );
  }
}

export default ServicePools;
