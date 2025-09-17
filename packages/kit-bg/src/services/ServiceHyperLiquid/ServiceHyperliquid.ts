import BigNumber from 'bignumber.js';
import { ethers } from 'ethersV6';
import pTimeout from 'p-timeout';

import type { ICoreHyperLiquidAgentCredential } from '@onekeyhq/core/src/types';
import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  EHyperLiquidAgentName,
  FALLBACK_BUILDER_ADDRESS,
  FALLBACK_MAX_BUILDER_FEE,
  HYPERLIQUID_AGENT_TTL_DEFAULT,
  HYPERLIQUID_REFERRAL_CODE,
  PERPS_CHAIN_ID,
} from '@onekeyhq/shared/src/consts/perp';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IApiRequestError,
  IApiRequestResult,
  IFill,
  IHex,
  IPerpsUniverse,
  IUserFillsByTimeParameters,
  IUserFillsParameters,
} from '@onekeyhq/shared/types/hyperliquid/sdk';

import localDb from '../../dbs/local/localDb';
import {
  perpsAccountLoadingInfoAtom,
  perpsSelectedAccountAtom,
  perpsSelectedAccountStatusAtom,
  perpsSelectedSymbolAtom,
} from '../../states/jotai/atoms';
import ServiceBase from '../ServiceBase';

import { hyperLiquidApiClients } from './hyperLiquidApiClients';

import type ServiceHyperliquidExchange from './ServiceHyperliquidExchange';
import type ServiceHyperliquidWallet from './ServiceHyperliquidWallet';
import type {
  IPerpsAccountLoadingInfo,
  IPerpsSelectedAccount,
  IPerpsSelectedAccountStatus,
  IPerpsSelectedAccountStatusDetails,
} from '../../states/jotai/atoms';
import type { IAccountDeriveTypes } from '../../vaults/types';
import type { IHyperliquidMaxBuilderFee } from '../ServiceWebviewPerp';

@backgroundClass()
export default class ServiceHyperliquid extends ServiceBase {
  public builderAddress: IHex = FALLBACK_BUILDER_ADDRESS;

  public maxBuilderFee: number = FALLBACK_MAX_BUILDER_FEE;

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
    void this.init();
  }

  private get exchangeService(): ServiceHyperliquidExchange {
    return this.backgroundApi.serviceHyperliquidExchange;
  }

  private get walletService(): ServiceHyperliquidWallet {
    return this.backgroundApi.serviceHyperliquidWallet;
  }

  private async init() {
    void this.backgroundApi.simpleDb.perp
      .getPerpData()
      .then((config) => {
        this.builderAddress = (config.hyperliquidBuilderAddress ||
          FALLBACK_BUILDER_ADDRESS) as IHex;
        this.maxBuilderFee =
          config.hyperliquidMaxBuilderFee || FALLBACK_MAX_BUILDER_FEE;
      })
      .catch((error) => {
        console.error('Failed to load perp config:', error);
      });
  }

  @backgroundMethod()
  async getUserFillsByTime(
    params: IUserFillsByTimeParameters,
  ): Promise<IFill[]> {
    const { infoClient } = hyperLiquidApiClients;

    return infoClient.userFillsByTime(params);
  }

  @backgroundMethod()
  async getUserFills(params: IUserFillsParameters): Promise<IFill[]> {
    const { infoClient } = hyperLiquidApiClients;

    return infoClient.userFills(params);
  }

  @backgroundMethod()
  async refreshTradingUniverse(): Promise<IPerpsUniverse[]> {
    const { infoClient } = hyperLiquidApiClients;
    // const dexList = (await this.infoClient.perpDexs()).filter(Boolean);
    const meta = await infoClient.meta({
      // dex: dexList?.[0]?.name || '',
    });
    if (meta?.universe?.length) {
      await this.backgroundApi.simpleDb.perp.setTradingUniverse(
        meta?.universe || [],
      );
    }
    const selectedSymbol = await perpsSelectedSymbolAtom.get();
    const { universeItems } = await this.changeSelectedSymbol({
      coin: selectedSymbol.coin,
    });
    return universeItems;
  }

  @backgroundMethod()
  async getTradingUniverse(): Promise<IPerpsUniverse[]> {
    return (await this.backgroundApi.simpleDb.perp.getTradingUniverse()) || [];
  }

  @backgroundMethod()
  async changeSelectedSymbol(params: { coin: string }): Promise<{
    universeItems: IPerpsUniverse[];
    selectedUniverse: IPerpsUniverse;
  }> {
    const universeItems = await this.getTradingUniverse();
    const selectedUniverse: IPerpsUniverse | undefined =
      universeItems.find((item) => item.name === params.coin) ||
      universeItems?.[0];
    await perpsSelectedSymbolAtom.set({
      coin: selectedUniverse?.name || '',
      universe: selectedUniverse,
    });
    return {
      universeItems,
      selectedUniverse,
    };
  }

  hideSelectAccountLoadingTimer: ReturnType<typeof setTimeout> | undefined;

  @backgroundMethod()
  async selectPerpsAccount(params: {
    accountId: string | null;
    indexedAccountId: string | null;
    deriveType: IAccountDeriveTypes;
  }) {
    const { indexedAccountId, accountId, deriveType } = params;

    const perpsAccount: IPerpsSelectedAccount = {
      indexedAccountId: indexedAccountId || null,
      accountId: null,
      accountAddress: null,
    };

    try {
      clearTimeout(this.hideSelectAccountLoadingTimer);
      await perpsAccountLoadingInfoAtom.set(
        (prev): IPerpsAccountLoadingInfo => ({
          ...prev,
          selectAccountLoading: true,
        }),
      );

      console.log('selectPerpsAccount______111', indexedAccountId, accountId);
      if (indexedAccountId || accountId) {
        const ethNetworkId = PERPS_CHAIN_ID;
        const account =
          await this.backgroundApi.serviceAccount.getNetworkAccount({
            indexedAccountId: indexedAccountId ?? undefined,
            accountId: indexedAccountId ? undefined : accountId ?? undefined,
            networkId: ethNetworkId,
            deriveType: deriveType || 'default',
          });
        console.log('selectPerpsAccount______222', account);
        perpsAccount.accountId = account.id || null;
        perpsAccount.accountAddress = (account.address as IHex) || null;
      }
    } catch (error) {
      console.error(error);
    } finally {
      clearTimeout(this.hideSelectAccountLoadingTimer);
      this.hideSelectAccountLoadingTimer = setTimeout(async () => {
        await perpsAccountLoadingInfoAtom.set(
          (prev): IPerpsAccountLoadingInfo => ({
            ...prev,
            selectAccountLoading: false,
          }),
        );
      }, 0);
    }

    await perpsSelectedAccountAtom.set(perpsAccount);
    return perpsAccount;
  }

  @backgroundMethod()
  @toastIfError()
  async enableTrading() {
    const result = await this.checkPerpsAccountStatus({
      isEnableTradingTrigger: true,
    });
    console.log('enableTradingV2___result', result);
    return result.status;
  }

  hideEnableTradingLoadingTimer: ReturnType<typeof setTimeout> | undefined;

  @backgroundMethod()
  async checkPerpsAccountStatus({
    accountAddress,
    password,
    isEnableTradingTrigger = false,
  }: {
    accountAddress?: IHex | null;
    password?: string;
    isEnableTradingTrigger?: boolean;
  } = {}) {
    const { infoClient } = hyperLiquidApiClients;
    try {
      clearTimeout(this.hideEnableTradingLoadingTimer);
      await perpsAccountLoadingInfoAtom.set(
        (prev): IPerpsAccountLoadingInfo => ({
          ...prev,
          enableTradingLoading: true,
        }),
      );

      const selectedAccount = await perpsSelectedAccountAtom.get();
      // eslint-disable-next-line no-param-reassign
      accountAddress =
        accountAddress ||
        (selectedAccount.accountAddress?.toLowerCase() as IHex);

      await this.exchangeService.setup({
        userAddress: accountAddress,
        userAccountId: selectedAccount.accountId ?? undefined,
      });

      // eslint-disable-next-line no-param-reassign
      password =
        password ||
        (await this.backgroundApi.servicePassword.getCachedPassword());
      if (!password && isEnableTradingTrigger) {
        // eslint-disable-next-line no-param-reassign
        ({ password } =
          await this.backgroundApi.servicePassword.promptPasswordVerify());
      }

      const statusDetails: IPerpsSelectedAccountStatusDetails = {
        activatedOk: false,
        agentOk: false,
        referralCodeOk: false,
        builderFeeOk: false,
      };
      if (!accountAddress) {
        throw new OneKeyLocalError(
          'Check perps account status ERROR: Account address is required',
        );
      }
      // eslint-disable-next-line no-param-reassign
      accountAddress = accountAddress.toLowerCase() as IHex;
      let agentCredential: ICoreHyperLiquidAgentCredential | undefined;
      if (password) {
        const userRole = await infoClient.userRole({
          user: accountAddress,
        });
        if (userRole.role === 'missing') {
          statusDetails.activatedOk = false;
          // await this.checkBuilderFeeStatus({
          //   accountAddress,
          //   isEnableTradingTrigger,
          //   statusDetails,
          // });
        } else {
          statusDetails.activatedOk = true;

          // TODO cache
          // Builder fee approve must be executed before agent setup
          await this.checkBuilderFeeStatus({
            accountAddress,
            isEnableTradingTrigger,
            statusDetails,
          });

          agentCredential = await this.checkAgentStatus({
            accountAddress,
            isEnableTradingTrigger,
            statusDetails,
            password,
          });

          if (agentCredential) {
            // TODO setupMasterWallet, setupAgentWallet
            await this.exchangeService.setup({
              userAddress: accountAddress,
              agentCredential,
            });

            void (async () => {
              const { referralCode } =
                await this.backgroundApi.simpleDb.perp.getPerpData();
              // referrer code can be approved by agent
              void this.exchangeService.setReferrerCode({
                code: referralCode || HYPERLIQUID_REFERRAL_CODE,
              });
            })();

            // referral code is optional, so we set it to true by default
            statusDetails.referralCodeOk = true;
          }
        }
      }

      const status: IPerpsSelectedAccountStatus = {
        accountAddress,
        canTrade:
          statusDetails.agentOk &&
          statusDetails.builderFeeOk &&
          statusDetails.referralCodeOk &&
          statusDetails.activatedOk,
        details: statusDetails,
      };
      await perpsSelectedAccountStatusAtom.set(status);

      return { status, agentCredential };
    } finally {
      clearTimeout(this.hideEnableTradingLoadingTimer);
      this.hideEnableTradingLoadingTimer = setTimeout(async () => {
        await perpsAccountLoadingInfoAtom.set(
          (prev): IPerpsAccountLoadingInfo => ({
            ...prev,
            enableTradingLoading: false,
          }),
        );
      }, 0);
    }
  }

  private async checkAgentStatus({
    accountAddress,
    isEnableTradingTrigger,
    statusDetails,
    password,
  }: {
    accountAddress: IHex;
    isEnableTradingTrigger: boolean;
    statusDetails: IPerpsSelectedAccountStatusDetails;
    password: string;
  }) {
    const { infoClient } = hyperLiquidApiClients;

    let agentCredential: ICoreHyperLiquidAgentCredential | undefined;
    // TODO cache
    const extraAgents = await infoClient.extraAgents({
      user: accountAddress,
    });
    if (extraAgents?.length) {
      const now = Date.now();
      const validAgents = (
        await Promise.all(
          extraAgents.map(async (agent) => {
            const credential = await localDb.getHyperLiquidAgentCredential({
              userAddress: accountAddress,
              agentName: agent.name as EHyperLiquidAgentName,
              password,
            });
            if (
              agent.address &&
              agent.validUntil >
                now +
                  timerUtils.getTimeDurationMs({
                    day: 1,
                  }) &&
              credential?.agentAddress?.toLowerCase() ===
                agent.address.toLowerCase()
            ) {
              credential.validUntil = agent.validUntil;
              return credential;
            }
            return null;
          }),
        )
      )
        .filter(Boolean)
        .sort((a, b) => b.validUntil - a.validUntil);
      agentCredential = validAgents?.[0];
    }
    if (!agentCredential && isEnableTradingTrigger) {
      const privateKeyBytes = crypto.getRandomValues(new Uint8Array(32));
      const privateKeyHex = bufferUtils.bytesToHex(privateKeyBytes);
      const agentAddress = new ethers.Wallet(privateKeyHex).address as IHex;

      const availableNames = [
        EHyperLiquidAgentName.OneKeyAgent1,
        EHyperLiquidAgentName.OneKeyAgent2,
        EHyperLiquidAgentName.OneKeyAgent3,
      ];
      let agentNameToApprove: EHyperLiquidAgentName | undefined;
      if (extraAgents.length === 3) {
        const agentToRemove = extraAgents.sort(
          (a, b) => a.validUntil - b.validUntil,
        )?.[0];
        const agentNameToRemove = agentToRemove?.name as
          | EHyperLiquidAgentName
          | undefined;
        if (agentToRemove) {
          if (agentNameToRemove && availableNames.includes(agentNameToRemove)) {
            agentNameToApprove = agentNameToRemove;
          } else {
            const approveAgentResult = await this.exchangeService.removeAgent({
              agentName: agentNameToRemove,
            });
            console.log('approveAgentResult::', approveAgentResult);
            await timerUtils.wait(4000);

            // Poll to verify agent removal instead of fixed delay
            const pollStartTime = Date.now();
            const pollTimeoutMs = 10_000; // 10 seconds total polling timeout
            const requestTimeoutMs = 3000; // 3 seconds per request timeout

            while (Date.now() - pollStartTime < pollTimeoutMs) {
              try {
                const currentExtraAgents = await pTimeout(
                  infoClient.extraAgents({
                    user: accountAddress,
                  }),
                  {
                    milliseconds: requestTimeoutMs,
                  },
                );

                // Check if the agent was successfully removed
                if (
                  !currentExtraAgents.some(
                    (agent) => agent.name === agentNameToRemove,
                  )
                ) {
                  console.log('Agent removal confirmed:', agentNameToRemove);
                  break;
                }
              } catch (error) {
                console.log('Polling request failed:', error);
              }

              // Wait 500ms before next poll attempt
              await timerUtils.wait(500);
            }
          }
        }
      }
      if (!agentNameToApprove) {
        for (const agentName of availableNames) {
          if (!extraAgents.some((agent) => agent.name === agentName)) {
            agentNameToApprove = agentName;
            break;
          }
        }
      }
      if (!agentNameToApprove) {
        agentNameToApprove = EHyperLiquidAgentName.OneKeyAgent1;
      }

      const { agentTTL = HYPERLIQUID_AGENT_TTL_DEFAULT } =
        await this.backgroundApi.simpleDb.perp.getPerpData();

      const validUntil = Date.now() + agentTTL;
      // {name} valid_until 1765710491688
      const agentNameToApproveWithValidUntil = `${agentNameToApprove} valid_until ${validUntil}`;
      const approveAgentFn = () =>
        this.exchangeService.approveAgent({
          agent: agentAddress,
          agentName: agentNameToApproveWithValidUntil as EHyperLiquidAgentName,
          // agentName: EHyperLiquidAgentName.Official,
          authorize: true,
        });
      let retryTimes = 5;
      let approveAgentResult: IApiRequestResult | undefined;
      while (retryTimes >= 0) {
        try {
          retryTimes -= 1;
          approveAgentResult = await approveAgentFn();
          if (
            approveAgentResult &&
            approveAgentResult.status === 'ok' &&
            approveAgentResult.response.type === 'default'
          ) {
            break;
          }
        } catch (error) {
          const requestError = error as IApiRequestError | undefined;
          console.log('approveAgentError::', requestError);
          if (
            requestError?.response &&
            requestError?.response.status === 'err' &&
            requestError?.response.response === 'User has pending agent removal'
          ) {
            if (retryTimes <= 0) {
              throw error;
            }
          } else {
            throw error;
          }
        }
        await timerUtils.wait(500);
      }

      console.log('approveAgentResult::', approveAgentResult);
      if (
        approveAgentResult &&
        approveAgentResult.status === 'ok' &&
        approveAgentResult.response.type === 'default'
      ) {
        const encodedPrivateKey =
          await this.backgroundApi.servicePassword.encodeSensitiveText({
            text: privateKeyHex,
          });

        const { credentialId } =
          await this.backgroundApi.serviceAccount.addOrUpdateHyperLiquidAgentCredential(
            {
              userAddress: accountAddress,
              agentAddress,
              agentName: agentNameToApprove as EHyperLiquidAgentName,
              privateKey: encodedPrivateKey,
              validUntil,
            },
          );

        if (credentialId) {
          const credential = await localDb.getHyperLiquidAgentCredential({
            userAddress: accountAddress,
            agentName: agentNameToApprove as EHyperLiquidAgentName,
            password,
          });
          if (credential) {
            agentCredential = credential;
          }
        }
      }
    }
    if (agentCredential) {
      statusDetails.agentOk = true;
    }
    return agentCredential;
  }

  private async checkBuilderFeeStatus({
    accountAddress,
    isEnableTradingTrigger,
    statusDetails,
  }: {
    accountAddress: IHex;
    isEnableTradingTrigger: boolean;
    statusDetails: IPerpsSelectedAccountStatusDetails;
  }) {
    const { expectBuilderAddress, expectMaxBuilderFee } =
      await this.getBuilderFeeConfig();

    if (expectBuilderAddress) {
      const maxBuilderFee = await this.getUserApprovedMaxBuilderFee({
        userAddress: accountAddress,
        builderAddress: expectBuilderAddress,
      });
      if (maxBuilderFee === expectMaxBuilderFee) {
        statusDetails.builderFeeOk = true;
      } else if (isEnableTradingTrigger) {
        const approveBuilderFeeResult =
          await this.exchangeService.approveBuilderFee({
            builder: expectBuilderAddress as IHex,
            maxFeeRate: `${new BigNumber(expectMaxBuilderFee)
              .div(1000)
              .toFixed()}%`,
          });
        if (
          approveBuilderFeeResult.status === 'ok' &&
          approveBuilderFeeResult.response.type === 'default'
        ) {
          statusDetails.builderFeeOk = true;
        }
        console.log('approveBuilderFeeResult::', approveBuilderFeeResult);
      }
    }
  }

  // TODO cache
  async getUserApprovedMaxBuilderFee({
    userAddress,
    builderAddress,
  }: {
    userAddress: string;
    builderAddress: string;
  }): Promise<IHyperliquidMaxBuilderFee> {
    const { infoClient } = hyperLiquidApiClients;
    return infoClient.maxBuilderFee({
      user: userAddress.toLowerCase() as IHex,
      builder: builderAddress.toLowerCase() as IHex,
    });
  }

  async getBuilderFeeConfig() {
    void this.backgroundApi.serviceWebviewPerp.updateBuilderFeeConfigByServerWithCache();
    let {
      hyperliquidBuilderAddress: expectBuilderAddress,
      hyperliquidMaxBuilderFee: expectMaxBuilderFee,
    } = await this.backgroundApi.simpleDb.perp.getPerpData();
    if (!expectMaxBuilderFee || expectMaxBuilderFee < 0) {
      expectMaxBuilderFee = 0;
    }
    if (!expectBuilderAddress) {
      expectBuilderAddress = '';
    }
    return {
      expectBuilderAddress: expectBuilderAddress.toLowerCase(),
      expectMaxBuilderFee,
    };
  }

  async dispose(): Promise<void> {
    // Cleanup resources if needed
  }
}
