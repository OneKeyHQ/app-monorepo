import BigNumber from 'bignumber.js';
import { findIndex, isEmpty } from 'lodash';

import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type {
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxActionAssetTransfer,
  IDecodedTxActionFunctionCall,
  IDecodedTxActionTokenActivate,
  IDecodedTxActionTokenApprove,
  IDecodedTxActionUnknown,
} from '@onekeyhq/shared/types/tx';
import {
  EApproveType,
  EDecodedTxActionType,
  EDecodedTxDirection,
} from '@onekeyhq/shared/types/tx';

import {
  EParseTxComponentType,
  ETransferDirection,
} from '../../types/signatureConfirm';
import { EEarnLabels, type IStakingInfo } from '../../types/staking';
import { ETranslations } from '../locale';
import { appLocale } from '../locale/appLocale';

import tokenRebaseUtils from './tokenRebaseUtils';

import type {
  IDisplayComponent,
  IDisplayComponentAddress,
  IDisplayComponentApprove,
  IDisplayComponentDefault,
  IDisplayComponentInternalAssets,
  IDisplayComponentNetwork,
  IDisplayComponentToken,
} from '../../types/signatureConfirm';
import type { ISwapTxInfo } from '../../types/swap/types';

export function buildTxActionDirection({
  from,
  to,
  accountAddress,
}: {
  from?: string;
  to: string;
  accountAddress: string;
}) {
  const fixedFrom = from?.toLowerCase() ?? '';
  const fixedTo = to?.toLowerCase() ?? '';
  const fixedAccountAddress = accountAddress?.toLowerCase() ?? '';

  // out first for internal send
  if (fixedFrom && fixedFrom === fixedAccountAddress) {
    return EDecodedTxDirection.OUT;
  }
  if (fixedTo && fixedTo === fixedAccountAddress) {
    return EDecodedTxDirection.IN;
  }
  return EDecodedTxDirection.OTHER;
}

export function getDisplayedActions({ decodedTx }: { decodedTx: IDecodedTx }) {
  const { outputActions, actions } = decodedTx;
  return (
    (outputActions && outputActions.length ? outputActions : actions) || []
  );
}

// collect every address that appears in a decoded tx's asset-transfer
// actions (transfer from/to plus raw UTXO inputs/outputs). Callers that
// already hold a decoded tx use this to tell vaults which addresses a
// history detail request actually involves (btc find-address narrowing).
export function collectDecodedTxInvolvedAddresses({
  decodedTx,
}: {
  decodedTx: IDecodedTx;
}): string[] {
  const addresses = new Set<string>();
  const add = (address: string | undefined) => {
    if (address) {
      addresses.add(address);
    }
  };
  for (const action of decodedTx.actions ?? []) {
    const transfer = action.assetTransfer;
    if (transfer) {
      transfer.sends.forEach((send) => {
        add(send.from);
        add(send.to);
      });
      transfer.receives.forEach((receive) => {
        add(receive.from);
        add(receive.to);
      });
      transfer.utxoFrom?.forEach((utxo) => add(utxo.address));
      transfer.utxoTo?.forEach((utxo) => add(utxo.address));
    }
  }
  return Array.from(addresses);
}

export function mergeAssetTransferActions(actions: IDecodedTxAction[]) {
  const otherActions: IDecodedTxAction[] = [];
  let mergedAssetTransferAction: IDecodedTxAction | null = null;
  actions.forEach((action) => {
    if (
      action.type === EDecodedTxActionType.ASSET_TRANSFER &&
      action.assetTransfer
    ) {
      if (mergedAssetTransferAction) {
        if (
          mergedAssetTransferAction.assetTransfer?.from ===
            action.assetTransfer.from &&
          mergedAssetTransferAction.assetTransfer.to === action.assetTransfer.to
        ) {
          mergedAssetTransferAction.assetTransfer.sends = [
            ...mergedAssetTransferAction.assetTransfer.sends,
            ...action.assetTransfer.sends,
          ];

          mergedAssetTransferAction.assetTransfer.receives = [
            ...mergedAssetTransferAction.assetTransfer.receives,
            ...action.assetTransfer.receives,
          ];

          mergedAssetTransferAction.assetTransfer.nativeAmount = new BigNumber(
            mergedAssetTransferAction.assetTransfer.nativeAmount ?? 0,
          )
            .plus(action.assetTransfer.nativeAmount ?? 0)
            .toFixed();

          mergedAssetTransferAction.assetTransfer.nativeAmountValue =
            new BigNumber(
              mergedAssetTransferAction.assetTransfer.nativeAmountValue ?? 0,
            )
              .plus(action.assetTransfer.nativeAmountValue ?? 0)
              .toFixed();
        } else {
          otherActions.push(action);
        }
      } else {
        mergedAssetTransferAction = action;
      }
    } else {
      otherActions.push(action);
    }
  });
  return [mergedAssetTransferAction, ...otherActions].filter(Boolean);
}

export function calculateNativeAmountInActions(actions: IDecodedTxAction[]) {
  let nativeAmount = '0';
  let nativeAmountValue = '0';

  actions.forEach((item) => {
    if (item.type === EDecodedTxActionType.ASSET_TRANSFER) {
      nativeAmount = new BigNumber(nativeAmount)
        .plus(item.assetTransfer?.nativeAmount ?? 0)
        .toFixed();
      nativeAmountValue = new BigNumber(nativeAmountValue)
        .plus(item.assetTransfer?.nativeAmountValue ?? 0)
        .toFixed();
    }
  });

  return {
    nativeAmount,
    nativeAmountValue,
  };
}

export function calculateTokenAmountInActions({
  actions,
  tokenAddress,
}: {
  actions: IDecodedTxAction[];
  tokenAddress: string;
}) {
  let tokenAmount = '0';
  actions.forEach((item) => {
    if (
      item.type === EDecodedTxActionType.ASSET_TRANSFER &&
      item.assetTransfer
    ) {
      item.assetTransfer.sends.forEach((send) => {
        if (
          send.tokenIdOnNetwork.toLowerCase() === tokenAddress.toLowerCase()
        ) {
          tokenAmount = new BigNumber(tokenAmount).plus(send.amount).toFixed();
        }
      });
    }
  });

  return {
    tokenAmount,
  };
}

// True when any decoded action involves a token whose balanceMultiplier
// actually scales (valid and !== 1). Used by the signature-confirm service
// to force the LOCAL txDisplay path: local decode emits display-basis
// amounts (and fail-closed approve editing), while server display
// components would carry raw amounts for these tokens.
export function checkDecodedTxHasScalingBalanceMultiplier(
  decodedTx: IDecodedTx,
): boolean {
  return (decodedTx.actions ?? []).some((action) => {
    if (
      tokenRebaseUtils.isScalingBalanceMultiplier(
        action.tokenApprove?.balanceMultiplier,
      )
    ) {
      return true;
    }
    const transfers = [
      ...(action.assetTransfer?.sends ?? []),
      ...(action.assetTransfer?.receives ?? []),
    ];
    return transfers.some((transfer) =>
      tokenRebaseUtils.isScalingBalanceMultiplier(transfer.balanceMultiplier),
    );
  });
}

// Address-tag severities that must survive a local-display replacement.
// SecurityCheckCard.getAddressRiskStatus reads the same set.
export const ADDRESS_RISK_TAG_DISPLAY_TYPES: ReadonlySet<string> = new Set([
  'warning',
  'critical',
]);

// When the signature-confirm service replaces server display components with
// locally decoded ones (scaled-UI forced-local path), the local Address
// components carry `tags: []`. The server may flag a risky counterparty ONLY
// via `Address.tags` without emitting `display.alerts`, so dropping the tags
// could also let a request without a scan render "No issues". Merge the
// server's risk tags back onto matching local Address components, and
// preserve risk-tagged server Address rows that have no local counterpart
// (the server may flag an address the local decoder never renders, e.g. the
// token contract on a plain transfer) by appending them verbatim — Address
// rows carry no amounts, so raw-basis contamination is impossible.
export function mergeServerAddressRiskTagsIntoComponents({
  localComponents,
  serverComponents,
}: {
  localComponents: IDisplayComponent[];
  serverComponents: IDisplayComponent[] | undefined;
}): IDisplayComponent[] {
  const serverRiskAddressComponents = (serverComponents ?? []).filter(
    (component): component is IDisplayComponentAddress =>
      component.type === EParseTxComponentType.Address &&
      Boolean(component.address) &&
      (component.tags ?? []).some((tag) =>
        ADDRESS_RISK_TAG_DISPLAY_TYPES.has(tag.displayType),
      ),
  );
  if (serverRiskAddressComponents.length === 0) {
    return localComponents;
  }

  const riskTagsByAddress = new Map<string, IDisplayComponentAddress['tags']>();
  for (const component of serverRiskAddressComponents) {
    const riskTags = (component.tags ?? []).filter((tag) =>
      ADDRESS_RISK_TAG_DISPLAY_TYPES.has(tag.displayType),
    );
    const key = component.address.toLowerCase();
    const existing = riskTagsByAddress.get(key) ?? [];
    const existingKeys = new Set(
      existing.map((tag) => `${tag.displayType}:${tag.value}`),
    );
    riskTagsByAddress.set(key, [
      ...existing,
      ...riskTags.filter(
        (tag) => !existingKeys.has(`${tag.displayType}:${tag.value}`),
      ),
    ]);
  }

  const localAddressKeys = new Set(
    localComponents
      .filter(
        (component): component is IDisplayComponentAddress =>
          component.type === EParseTxComponentType.Address &&
          Boolean(component.address),
      )
      .map((component) => component.address.toLowerCase()),
  );

  const merged = localComponents.map((component) => {
    if (component.type !== EParseTxComponentType.Address) {
      return component;
    }
    const serverRiskTags = component.address
      ? riskTagsByAddress.get(component.address.toLowerCase())
      : undefined;
    if (!serverRiskTags?.length) {
      return component;
    }
    const existingTagKeys = new Set(
      (component.tags ?? []).map((tag) => `${tag.displayType}:${tag.value}`),
    );
    const mergedTags = [
      ...(component.tags ?? []),
      ...serverRiskTags.filter(
        (tag) => !existingTagKeys.has(`${tag.displayType}:${tag.value}`),
      ),
    ];
    return { ...component, tags: mergedTags };
  });

  const unmatchedServerRiskComponents = serverRiskAddressComponents.filter(
    (component) => !localAddressKeys.has(component.address.toLowerCase()),
  );

  return [...merged, ...unmatchedServerRiskComponents];
}

export function isSendNativeTokenAction(action: IDecodedTxAction) {
  return (
    action.type === EDecodedTxActionType.ASSET_TRANSFER &&
    action.assetTransfer?.sends.every((send) => send.isNative)
  );
}

export function getTxnType({
  actions,
  swapInfo,
  stakingInfo,
}: {
  actions: IDecodedTxAction[];
  swapInfo?: ISwapTxInfo;
  stakingInfo?: IStakingInfo;
}) {
  if (
    swapInfo ||
    actions.some((action) => action.type === EDecodedTxActionType.INTERNAL_SWAP)
  ) {
    return 'swap';
  }

  if (
    stakingInfo ||
    actions.some(
      (action) => action.type === EDecodedTxActionType.INTERNAL_STAKE,
    )
  ) {
    return 'stake';
  }

  if (
    actions.some((action) => action.type === EDecodedTxActionType.TOKEN_APPROVE)
  ) {
    return 'approve';
  }

  if (
    actions.some(
      (action) => action.type === EDecodedTxActionType.ASSET_TRANSFER,
    )
  ) {
    return 'send';
  }

  if (
    actions.some((action) => action.type === EDecodedTxActionType.FUNCTION_CALL)
  ) {
    return 'function call';
  }

  return 'unknown';
}

export function getStakingActionLabel({
  stakingInfo,
}: {
  stakingInfo: IStakingInfo;
}) {
  switch (stakingInfo.label) {
    case EEarnLabels.Claim:
      return appLocale.intl.formatMessage({
        id: ETranslations.earn_claim,
      });
    case EEarnLabels.Stake:
      return appLocale.intl.formatMessage({
        id: ETranslations.earn_deposit,
      });
    case EEarnLabels.Redeem:
      return appLocale.intl.formatMessage({
        id: ETranslations.earn_redeem,
      });
    case EEarnLabels.Withdraw:
      return appLocale.intl.formatMessage({
        id: ETranslations.global_withdraw,
      });
    case EEarnLabels.Supply:
      return appLocale.intl.formatMessage({
        id: ETranslations.defi_supply,
      });
    case EEarnLabels.Borrow:
      return appLocale.intl.formatMessage({
        id: ETranslations.global_borrow,
      });
    case EEarnLabels.Repay:
      return appLocale.intl.formatMessage({
        id: ETranslations.defi_repay,
      });
    case EEarnLabels.Sell:
      return appLocale.intl.formatMessage({
        id: ETranslations.global_sell,
      });
    case EEarnLabels.Buy:
      return appLocale.intl.formatMessage({
        id: ETranslations.global_buy,
      });
    default:
      return appLocale.intl.formatMessage({
        id: ETranslations.global_unknown,
      });
  }
}

export function convertAddressToSignatureConfirmAddress({
  address,
  label,
  showAccountName,
}: {
  address: string;
  label?: string;
  showAccountName?: boolean;
}): IDisplayComponentAddress {
  return {
    type: EParseTxComponentType.Address,
    label:
      label ??
      appLocale.intl.formatMessage({
        id: ETranslations.copy_address_modal_title,
      }),
    address,
    tags: [],
    showAccountName,
  };
}

export function convertNetworkToSignatureConfirmNetwork({
  networkId,
  label,
}: {
  networkId: string;
  label?: string;
}): IDisplayComponentNetwork {
  return {
    type: EParseTxComponentType.Network,
    label:
      label ??
      appLocale.intl.formatMessage({
        id: ETranslations.network__network,
      }),
    networkId,
  };
}

function getUniqueAddresses(addresses: string[]) {
  return Array.from(new Set(addresses.filter(Boolean)));
}

function convertAssetTransferActionToSignatureConfirmComponent({
  action,
  unsignedTx,
  isUTXO,
}: {
  action: IDecodedTxActionAssetTransfer;
  unsignedTx: IUnsignedTxPro;
  isUTXO?: boolean;
}) {
  const components: IDisplayComponent[] = [];

  const isInternalSwap = !!unsignedTx.swapInfo;
  const isInternalStake = !!unsignedTx.stakingInfo;

  action.sends.forEach((send) => {
    const assetsLabel = isInternalSwap
      ? appLocale.intl.formatMessage({
          id: ETranslations.global_pay,
        })
      : appLocale.intl.formatMessage({
          id: ETranslations.global_asset,
        });

    const assetsComponent: IDisplayComponentInternalAssets = {
      type: EParseTxComponentType.InternalAssets,
      label: assetsLabel,
      name: send.name,
      icon: send.icon,
      symbol: send.symbol,
      amount: '',
      amountParsed: send.amount,
      networkId: send.networkId,
      isNFT: send.isNFT,
      NFTType: send.NFTType,
      transferDirection: ETransferDirection.Out,
    };

    components.push(assetsComponent);
  });

  action.receives.forEach((receive) => {
    const assetsLabel = isInternalSwap
      ? appLocale.intl.formatMessage({
          id: ETranslations.sign_swap_estimate_receive,
        })
      : appLocale.intl.formatMessage({
          id: ETranslations.global_asset,
        });

    const assetsComponent: IDisplayComponentInternalAssets = {
      type: EParseTxComponentType.InternalAssets,
      label: assetsLabel,
      name: receive.name,
      icon: receive.icon,
      symbol: receive.symbol,
      amount: '',
      amountParsed: receive.amount,
      networkId: receive.networkId,
      isNFT: receive.isNFT,
      NFTType: receive.NFTType,
      transferDirection: ETransferDirection.In,
    };

    components.push(assetsComponent);
  });

  if (isInternalSwap && unsignedTx.swapInfo) {
    const receiveAddressComponent: IDisplayComponentAddress = {
      type: EParseTxComponentType.Address,
      label: appLocale.intl.formatMessage({
        id: ETranslations.swap_history_detail_received_address,
      }),
      address: unsignedTx.swapInfo.receivingAddress,
      tags: [],
      networkId: unsignedTx.swapInfo.receiver.accountInfo.networkId,
      highlight: true,
    };

    components.push(receiveAddressComponent);
  }

  let showInteractWithContract = false;

  if (isInternalSwap) {
    showInteractWithContract = true;
  } else if (isInternalStake) {
    showInteractWithContract = !isUTXO;
  }

  const toAddresses = showInteractWithContract
    ? getUniqueAddresses(action.to ? [action.to] : [])
    : getUniqueAddresses(action.sends.map((send) => send.to));

  const addressComponents = toAddresses.length
    ? toAddresses
    : getUniqueAddresses(action.to ? [action.to] : []);

  addressComponents.forEach((address) => {
    const toAddressComponent: IDisplayComponentAddress = {
      type: EParseTxComponentType.Address,
      label: showInteractWithContract
        ? appLocale.intl.formatMessage({
            id: ETranslations.sig_interact_contract_label,
          })
        : appLocale.intl.formatMessage({
            id: ETranslations.global_to,
          }),
      address,
      tags: [],
      isNavigable: showInteractWithContract,
      highlight: !showInteractWithContract,
    };

    components.push(toAddressComponent);
  });

  return components;
}

function convertTokenApproveActionToSignatureConfirmComponent({
  action,
  isMultiTxs,
  networkId,
  interactWithContract,
}: {
  action: IDecodedTxActionTokenApprove;
  isMultiTxs?: boolean;
  networkId: string;
  interactWithContract?: string;
}) {
  // Only absolute `approve(spender, 0)` is a revoke. `increaseAllowance(spender, 0)`
  // and `increaseApproval(spender, 0)` are no-op increments, not revocations.
  // Treat undefined approveType as absolute approve for legacy chains that don't tag it.
  const isAbsoluteApprove =
    !action.approveType || action.approveType === EApproveType.Approve;
  const isRevoke = isAbsoluteApprove && new BigNumber(action.amount).isZero();
  let approveLabel = '';

  if (isMultiTxs) {
    approveLabel = isRevoke
      ? appLocale.intl.formatMessage({
          id: ETranslations.global_revoke,
        })
      : appLocale.intl.formatMessage({
          id: ETranslations.global_approve,
        });
  } else {
    approveLabel = appLocale.intl.formatMessage({
      id: ETranslations.global_asset,
    });
  }

  // Scaled-UI (rebase) tokens: `action.amount` is display-basis (multiplied
  // at decode). The editor write-back re-encodes amountParsed verbatim as
  // raw units, so editing must be fail-closed to prevent over-approval by
  // the multiplier. Multiplier === 1 is the documented no-op — never block.
  const isScalingMultiplier = tokenRebaseUtils.isScalingBalanceMultiplier(
    action.balanceMultiplier,
  );

  const approveComponent: IDisplayComponentApprove = {
    type: EParseTxComponentType.Approve,
    label: approveLabel,
    // @ts-ignore
    token: {
      info: {
        symbol: action.symbol,
        name: action.name,
        address: action.tokenIdOnNetwork,
        isNative: false,
        decimals: action.decimals,
        logoURI: action.icon,
        balanceMultiplier: action.balanceMultiplier,
      },
    },
    amountParsed: action.amount,
    isEditable: !isRevoke && !isMultiTxs && !isScalingMultiplier,
    isInfiniteAmount: action.isInfiniteAmount,
    networkId,
    approveType: action.approveType,
    spender: action.spender,
  };

  const spenderComponent: IDisplayComponentAddress | null = isMultiTxs
    ? null
    : {
        type: EParseTxComponentType.Address,
        label: isRevoke
          ? appLocale.intl.formatMessage({
              id: ETranslations.sig_revoke_from_label,
            })
          : appLocale.intl.formatMessage({
              id: ETranslations.sig_approve_to_label,
            }),
        address: action.spender,
        tags: [],
        isNavigable: true,
      };

  const interactWithContractComponent: IDisplayComponentAddress | null =
    interactWithContract && !isMultiTxs
      ? {
          type: EParseTxComponentType.Address,
          label: appLocale.intl.formatMessage({
            id: ETranslations.sig_interact_contract_label,
          }),
          address: interactWithContract,
          tags: [],
          isNavigable: true,
        }
      : null;

  return [
    approveComponent,
    spenderComponent,
    interactWithContractComponent,
  ].filter(Boolean);
}

function convertTokenActiveActionToSignatureConfirmComponent({
  action,
  networkId,
}: {
  action: IDecodedTxActionTokenActivate;
  networkId: string;
}) {
  const component: IDisplayComponentToken = {
    type: EParseTxComponentType.Token,
    label: appLocale.intl.formatMessage({
      id: ETranslations.global_asset,
    }),
    networkId,
    // @ts-ignore
    token: {
      // @ts-ignore
      info: {
        symbol: action.symbol,
        name: action.name,
        address: action.tokenIdOnNetwork,
        decimals: action.decimals,
        logoURI: action.icon,
      },
    },
  };

  return [component];
}

function convertFunctionCallActionToSignatureConfirmComponent({
  action,
}: {
  action: IDecodedTxActionFunctionCall;
}) {
  const components: IDisplayComponent[] = [];

  const component: IDisplayComponentDefault = {
    type: EParseTxComponentType.Default,
    label: 'Operation',
    value: action.functionName,
  };

  components.push(component);

  if (action.to) {
    const interactWithContractComponent: IDisplayComponentAddress = {
      type: EParseTxComponentType.Address,
      label: appLocale.intl.formatMessage({
        id: ETranslations.sig_interact_contract_label,
      }),
      address: action.to,
      tags: [],
      isNavigable: true,
    };

    components.push(interactWithContractComponent);
  }

  return components;
}

function convertUnknownActionToSignatureConfirmComponent({
  action,
}: {
  action: IDecodedTxActionUnknown;
}) {
  if (!action.to) {
    return [];
  }

  const interactWithContractComponent: IDisplayComponentAddress = {
    type: EParseTxComponentType.Address,
    label: appLocale.intl.formatMessage({
      id: ETranslations.sig_interact_contract_label,
    }),
    address: action.to,
    tags: [],
    isNavigable: true,
  };

  return [interactWithContractComponent];
}

export function convertDecodedTxActionsToSignatureConfirmTxDisplayComponents({
  decodedTx,
  isMultiTxs,
  unsignedTx,
  isUTXO,
}: {
  decodedTx: IDecodedTx;
  unsignedTx: IUnsignedTxPro;
  isMultiTxs?: boolean;
  isUTXO?: boolean;
}): IDisplayComponent[] {
  const { actions, networkId } = decodedTx;
  const components: IDisplayComponent[] = [];

  for (const action of actions) {
    if (
      action.type === EDecodedTxActionType.ASSET_TRANSFER &&
      action.assetTransfer
    ) {
      components.push(
        ...convertAssetTransferActionToSignatureConfirmComponent({
          action: action.assetTransfer,
          unsignedTx,
          isUTXO,
        }),
      );
    } else if (
      action.type === EDecodedTxActionType.TOKEN_APPROVE &&
      action.tokenApprove
    ) {
      components.push(
        ...convertTokenApproveActionToSignatureConfirmComponent({
          action: action.tokenApprove,
          isMultiTxs,
          networkId,
          interactWithContract: unsignedTx.approveInfo?.permit2Info
            ? action.tokenApprove.to
            : undefined,
        }),
      );
    } else if (
      action.type === EDecodedTxActionType.TOKEN_ACTIVATE &&
      action.tokenActivate
    ) {
      components.push(
        ...convertTokenActiveActionToSignatureConfirmComponent({
          action: action.tokenActivate,
          networkId,
        }),
      );
    } else if (
      action.type === EDecodedTxActionType.FUNCTION_CALL &&
      action.functionCall
    ) {
      components.push(
        ...convertFunctionCallActionToSignatureConfirmComponent({
          action: action.functionCall,
        }),
      );
    } else if (
      action.type === EDecodedTxActionType.UNKNOWN &&
      action.unknownAction
    ) {
      components.push(
        ...convertUnknownActionToSignatureConfirmComponent({
          action: action.unknownAction,
        }),
      );
    }
  }

  return components;
}

export function convertDecodedTxActionsToSignatureConfirmTxDisplayTitle({
  decodedTxs,
  unsignedTxs,
}: {
  decodedTxs: IDecodedTx[];
  unsignedTxs: IUnsignedTxPro[];
}) {
  const swapTxIndex = findIndex(unsignedTxs, (tx) => !!tx.swapInfo);
  const stakingTxIndex = findIndex(unsignedTxs, (tx) => !!tx.stakingInfo);

  const swapUnsignedTx = unsignedTxs[swapTxIndex];
  const stakingUnsignedTx = unsignedTxs[stakingTxIndex];

  if (swapUnsignedTx && swapUnsignedTx.swapInfo) {
    const isBridge =
      swapUnsignedTx.swapInfo.sender.accountInfo.networkId !==
      swapUnsignedTx.swapInfo.receiver.accountInfo.networkId;
    return isBridge
      ? appLocale.intl.formatMessage({
          id: ETranslations.swap_page_bridge,
        })
      : appLocale.intl.formatMessage({
          id: ETranslations.swap_page_swap,
        });
  }

  if (stakingUnsignedTx && stakingUnsignedTx.stakingInfo) {
    return getStakingActionLabel({
      stakingInfo: stakingUnsignedTx.stakingInfo,
    });
  }

  // only swap tx may have multiple txs
  const actions = decodedTxs[0].actions;

  for (const action of actions) {
    if (
      action.type === EDecodedTxActionType.ASSET_TRANSFER &&
      action.assetTransfer
    ) {
      const sends = action.assetTransfer.sends;
      const receives = action.assetTransfer.receives;

      if (!isEmpty(sends) && isEmpty(receives)) {
        return appLocale.intl.formatMessage({
          id: ETranslations.global_send,
        });
      }

      if (isEmpty(sends) && !isEmpty(receives)) {
        return appLocale.intl.formatMessage({
          id: ETranslations.global_receive,
        });
      }
    }

    if (
      action.type === EDecodedTxActionType.TOKEN_APPROVE &&
      action.tokenApprove
    ) {
      const isAbsoluteApprove =
        !action.tokenApprove.approveType ||
        action.tokenApprove.approveType === EApproveType.Approve;
      const isRevoke =
        isAbsoluteApprove && new BigNumber(action.tokenApprove.amount).isZero();

      return isRevoke
        ? appLocale.intl.formatMessage({
            id: ETranslations.sig_revoke_approval_label,
          })
        : appLocale.intl.formatMessage({
            id: ETranslations.sig_approval_label,
          });
    }

    if (
      action.type === EDecodedTxActionType.FUNCTION_CALL &&
      action.functionCall
    ) {
      return appLocale.intl.formatMessage({
        id: ETranslations.transaction__contract_interaction,
      });
    }
  }

  return appLocale.intl.formatMessage({
    id: ETranslations.transaction__contract_interaction,
  });
}
