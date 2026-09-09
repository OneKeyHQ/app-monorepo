import type { IBadgeType } from '@onekeyhq/components';
import { ADDRESS_RISK_TAG_DISPLAY_TYPES } from '@onekeyhq/shared/src/utils/txActionUtils';
import { ENFTType } from '@onekeyhq/shared/types/nft';
import {
  EParseTxComponentType,
  ETransferDirection,
  type IDisplayComponent,
  type IDisplayComponentSimulation,
} from '@onekeyhq/shared/types/signatureConfirm';

export type ISimulationAsset = IDisplayComponentSimulation['assets'][number];

export type ISimulationGroup = {
  id: string;
  label: string;
  assets: ISimulationAsset[];
};

function findParserAlertSentenceEnd(text: string) {
  // Backend alerts can contain arbitrary ASCII abbreviations. Treating their
  // periods as sentence boundaries can produce a misleading, incomplete title.
  return text.search(/[。！？]|[!?](?=\s|$)/);
}

// Address details stay next to the address row. The card consumes only their
// severity as a fallback when a targeted request scan has no conclusion.
export function getAddressRiskStatus(components: IDisplayComponent[]) {
  let status: Extract<IBadgeType, 'critical' | 'warning'> | undefined;

  components.forEach((component) => {
    if (component.type !== EParseTxComponentType.Address) {
      return;
    }
    component.tags.forEach((tag) => {
      if (!ADDRESS_RISK_TAG_DISPLAY_TYPES.has(tag.displayType)) {
        return;
      }
      if (tag.displayType === 'critical') {
        status = 'critical';
      } else if (!status) {
        status = 'warning';
      }
    });
  });

  return status;
}

export function shouldShowNoIssueSection({
  hasCardFindings,
  hasResolvedRequiredChecks,
  isSecurityCheckPending,
}: {
  hasCardFindings: boolean;
  hasResolvedRequiredChecks: boolean;
  isSecurityCheckPending?: boolean;
}) {
  return (
    !hasCardFindings && hasResolvedRequiredChecks && !isSecurityCheckPending
  );
}

export function normalizeAlertText(text?: string) {
  return text?.trim().replace(/\s+/g, ' ').toLowerCase() ?? '';
}

export function normalizeSecurityFindingTitle(title: string) {
  const trimmedTitle = title.trim();
  return trimmedTitle.replace(/[。.！!]+$/u, '') || trimmedTitle;
}

export function shouldHideGenericPermitAlert({
  alert,
  genericPermitAlert,
  isPermitSignMethod,
  isSiteVerified,
}: {
  alert: string;
  genericPermitAlert: string;
  isPermitSignMethod: boolean;
  isSiteVerified: boolean;
}) {
  const normalizedAlert = normalizeAlertText(alert);
  return (
    isPermitSignMethod &&
    isSiteVerified &&
    Boolean(normalizedAlert) &&
    normalizedAlert === normalizeAlertText(genericPermitAlert)
  );
}

export function getParserAlertDisplay(alert: string) {
  const normalizedAlert = alert.trim();
  if (normalizedAlert.length <= 80) {
    return { title: normalizedAlert };
  }

  const sentenceEndIndex = findParserAlertSentenceEnd(normalizedAlert);
  const firstSentence =
    sentenceEndIndex > 0 ? normalizedAlert.slice(0, sentenceEndIndex + 1) : '';

  if (firstSentence && firstSentence.length <= 100) {
    const description = normalizedAlert.slice(firstSentence.length).trim();
    return {
      title: firstSentence,
      description: description || undefined,
    };
  }

  return {
    title: normalizedAlert,
  };
}

export const SIMULATION_GROUP_FALLBACK_ID = 'asset-changes';

// These asset-display helpers are a compact, read-only variant of the canonical
// simulation rendering in SignatureConfirmComponents/Assets.tsx. Keep the
// direction-sign, NFT-amount, and color rules in sync with it to avoid drift
// (covered by utils.test.ts).
export function getSimulationAssetLabel(asset: ISimulationAsset) {
  if (asset.type === EParseTxComponentType.Token) {
    return asset.token.info.symbol;
  }
  if (asset.type === EParseTxComponentType.NFT) {
    return asset.nft.metadata?.name || asset.nft.collectionName || 'NFT';
  }
  if (asset.isNFT) {
    return asset.name || asset.symbol || 'NFT';
  }
  return asset.symbol || asset.name;
}

export function getSimulationAssetAmount(asset: ISimulationAsset) {
  if (asset.type === EParseTxComponentType.Token) {
    // `amount` is the raw base-unit value for fungible assets. Never fall back
    // to it in a human-readable preview (for example, 1 ETH could otherwise
    // be rendered as 1000000000000000000).
    return asset.amountParsed ?? '';
  }
  if (asset.type === EParseTxComponentType.InternalAssets) {
    if (asset.isNFT && asset.NFTType !== ENFTType.ERC1155) {
      return '';
    }
    return asset.amountParsed ?? '';
  }
  // Match the canonical Assets renderer: a non-ERC1155 NFT shows only its name,
  // never a numeric quantity (a unique token's "1" is noise).
  if (asset.nft.collectionType !== ENFTType.ERC1155) {
    return '';
  }
  return asset.amount;
}

export function getSimulationAssetDirection(asset: ISimulationAsset) {
  if ('transferDirection' in asset) {
    return asset.transferDirection;
  }
  return undefined;
}

export function getSimulationAssetSign(asset: ISimulationAsset) {
  const direction = getSimulationAssetDirection(asset);
  if (direction) {
    if (direction === ETransferDirection.In) {
      return '+';
    }
    if (direction === ETransferDirection.Out) {
      return '-';
    }
  }
  return '';
}

export function getSimulationAssetNetworkId(asset: ISimulationAsset) {
  if (asset.type === EParseTxComponentType.Token) {
    return asset.networkId ?? asset.token.info.networkId;
  }
  if (asset.type === EParseTxComponentType.NFT) {
    return asset.networkId ?? asset.nft.networkId;
  }
  return asset.networkId;
}

export function shouldShowSimulationAssetNetwork(asset: ISimulationAsset) {
  if ('showNetwork' in asset) {
    return asset.showNetwork;
  }
  return false;
}

export function getSimulationAssetIconProps(asset: ISimulationAsset) {
  if (asset.type === EParseTxComponentType.Token) {
    return {
      tokenImageUri: asset.token.info.logoURI,
      networkId: asset.networkId ?? asset.token.info.networkId,
      showNetworkIcon: asset.showNetwork,
    };
  }
  if (asset.type === EParseTxComponentType.NFT) {
    return {
      isNFT: true,
      tokenImageUri: asset.nft.metadata?.image,
      networkId: asset.networkId ?? asset.nft.networkId,
      showNetworkIcon: asset.showNetwork,
    };
  }
  return {
    isNFT: asset.isNFT,
    tokenImageUri: asset.icon,
    networkId: asset.networkId,
    showNetworkIcon: shouldShowSimulationAssetNetwork(asset),
  };
}

export function getShownSimulationAssetNetworkId(asset: ISimulationAsset) {
  if (!shouldShowSimulationAssetNetwork(asset)) {
    return undefined;
  }
  return getSimulationAssetNetworkId(asset);
}

export function getSimulationGroups(
  simulationComponents?: IDisplayComponentSimulation[],
) {
  return (
    simulationComponents
      ?.map((component, index) => ({
        id: `${component.label || SIMULATION_GROUP_FALLBACK_ID}-${index}`,
        label: component.label || SIMULATION_GROUP_FALLBACK_ID,
        assets: component.assets,
      }))
      .filter((group) => group.assets.length > 0) ?? []
  );
}
