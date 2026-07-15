import { EAppUpdateRoutes } from './appUpdate';
import { EDAppConnectionModal } from './dAppConnection';
import { EActionCenterPages, EFullScreenPushRoutes } from './fullScreenPush';
import { EModalRoutes } from './modal';
import { onboardingV2RouteConfig } from './onboardingv2';
import { EModalReferFriendsRoutes } from './referFriends';
import { EModalRewardCenterRoutes } from './rewardCenter';
import { ERootRoutes } from './root';
import { EModalSettingRoutes } from './setting';
import { EModalSignatureConfirmRoutes } from './signatureConfirm';
import { EModalStakingRoutes } from './staking';
import { ETestModalPages } from './testModal';
import { EWebViewRoutes } from './webView';

// Both policies are parser allow-list entries. "internal" documents an
// app-owned entry point; it is not an authentication or authorization boundary.
export type ERouteColdStartPolicy = 'public' | 'internal';
export type ERoutePresentation = 'modal' | 'iosFullScreen';

export interface IRoutePathMetadata<TName extends string = string> {
  readonly name: TName;
  readonly rewrite?: string;
  readonly exact?: boolean;
}

export interface IRoutePathConfig<
  TName extends string = string,
> extends IRoutePathMetadata<TName> {
  readonly children?: readonly IRoutePathConfig[];
}

export interface IRouteManifestEntry<
  TName extends string = string,
> extends IRoutePathMetadata<TName> {
  readonly coldStart?: ERouteColdStartPolicy;
  readonly children?: readonly IRouteManifestEntry[];
  readonly presentations?: readonly ERoutePresentation[];
}

type IRouteManifestOverride = Omit<IRouteManifestEntry, 'name'>;

class RouteManifestError extends Error {}

interface IDefineRouteManifestOptions<TName extends string> {
  defaults?: IRouteManifestOverride;
  overrides?: Partial<Record<TName, IRouteManifestOverride>>;
}

export const defineRouteManifest = <TName extends string>(
  names: readonly TName[],
  options: IDefineRouteManifestOptions<TName> = {},
): readonly IRouteManifestEntry<TName>[] => {
  const uniqueNames = new Set(names);
  if (uniqueNames.size !== names.length) {
    throw new RouteManifestError('Route manifest contains duplicate names');
  }

  return Object.freeze(
    names.map((name) =>
      Object.freeze({
        name,
        ...options.defaults,
        ...options.overrides?.[name],
      }),
    ),
  );
};

export const projectColdStartRouteManifest = (
  manifest: readonly IRouteManifestEntry[],
): IRoutePathConfig[] =>
  manifest
    .filter((entry) => entry.coldStart)
    .map((entry) => {
      const children = entry.children
        ? projectColdStartRouteManifest(entry.children)
        : undefined;

      return {
        name: entry.name,
        ...(entry.rewrite ? { rewrite: entry.rewrite } : {}),
        ...(entry.exact ? { exact: true } : {}),
        ...(children?.length ? { children } : {}),
      };
    });

export const filterRouteManifestByPresentation = (
  manifest: readonly IRouteManifestEntry[],
  presentation: ERoutePresentation,
): readonly IRouteManifestEntry[] =>
  manifest.filter((entry) => entry.presentations?.includes(presentation));

interface IBindRouteManifestOptions {
  allowUnknownBindings?: boolean;
}

// UI bindings provide components and lifecycle hooks only. Path metadata stays
// authoritative in the manifest, and every manifest route must be bound once.
export const bindRouteManifest = <
  TName extends string,
  TBinding extends { name: string; rewrite?: string; exact?: boolean },
>(
  manifest: readonly IRouteManifestEntry<TName>[],
  bindings: readonly TBinding[],
  options: IBindRouteManifestOptions = {},
): TBinding[] => {
  const manifestByName = new Map<string, IRouteManifestEntry<TName>>(
    manifest.map((entry) => [entry.name, entry]),
  );
  const bindingNames = new Set<string>();

  bindings.forEach((binding) => {
    if (bindingNames.has(binding.name)) {
      throw new RouteManifestError(`Duplicate route binding: ${binding.name}`);
    }
    bindingNames.add(binding.name);

    if (!options.allowUnknownBindings && !manifestByName.has(binding.name)) {
      throw new RouteManifestError(`Unknown route binding: ${binding.name}`);
    }

    if (
      manifestByName.has(binding.name) &&
      (binding.rewrite !== undefined || binding.exact !== undefined)
    ) {
      throw new RouteManifestError(
        `Route path metadata must be declared in the manifest: ${binding.name}`,
      );
    }
  });

  manifest.forEach((entry) => {
    if (!bindingNames.has(entry.name)) {
      throw new RouteManifestError(`Missing route binding: ${entry.name}`);
    }
  });

  return bindings.map((binding) => {
    const entry = manifestByName.get(binding.name);
    if (!entry) {
      return binding;
    }

    return {
      ...binding,
      name: entry.name,
      ...(entry.rewrite ? { rewrite: entry.rewrite } : {}),
      ...(entry.exact ? { exact: true } : {}),
    };
  });
};

export const rewardCenterRouteManifest = defineRouteManifest(
  Object.values(EModalRewardCenterRoutes),
  {
    overrides: {
      [EModalRewardCenterRoutes.RewardCenter]: {
        coldStart: 'public',
        rewrite: '/reward-center',
        exact: true,
      },
    },
  },
);

export const settingRouteManifest = defineRouteManifest(
  Object.values(EModalSettingRoutes),
  {
    overrides: {
      [EModalSettingRoutes.SettingListModal]: {
        coldStart: 'public',
        rewrite: '/',
      },
      [EModalSettingRoutes.SettingProtectModal]: {
        coldStart: 'public',
        rewrite: '/protection',
      },
    },
  },
);

export const appUpdateRouteManifest = defineRouteManifest(
  Object.values(EAppUpdateRoutes),
  {
    overrides: {
      [EAppUpdateRoutes.UpdatePreview]: {
        coldStart: 'public',
        rewrite: '/preview',
      },
      [EAppUpdateRoutes.FeaturedChangelogPreview]: {
        coldStart: 'public',
        rewrite: '/changelog-preview',
      },
    },
  },
);

export const stakingRouteManifest = defineRouteManifest(
  Object.values(EModalStakingRoutes),
  {
    overrides: {
      [EModalStakingRoutes.ProtocolDetails]: {
        coldStart: 'public',
        rewrite: '/defi/staking/:symbol/:provider',
        exact: true,
      },
      [EModalStakingRoutes.ProtocolDetailsV2]: {
        coldStart: 'public',
        rewrite: '/defi/staking/v2/:symbol/:provider',
        exact: true,
      },
      [EModalStakingRoutes.ProtocolDetailsV2Share]: {
        coldStart: 'public',
        rewrite: '/defi/:network/:symbol/:provider',
        exact: true,
      },
      [EModalStakingRoutes.ManagePosition]: {
        coldStart: 'internal',
        exact: true,
      },
      [EModalStakingRoutes.BorrowManagePosition]: {
        exact: true,
      },
    },
  },
);

// VerifyMessage has no navigator screen. Keeping it out of the manifest avoids
// producing navigation state that the full DApp navigator cannot render.
const dAppConnectionRouteNames = Object.values(EDAppConnectionModal).filter(
  (name) => name !== EDAppConnectionModal.VerifyMessage,
);

export const dAppConnectionRouteManifest = defineRouteManifest(
  dAppConnectionRouteNames,
  { defaults: { coldStart: 'internal' } },
);

export const signatureConfirmRouteManifest = defineRouteManifest(
  Object.values(EModalSignatureConfirmRoutes),
  {
    overrides: {
      [EModalSignatureConfirmRoutes.TxConfirmFromDApp]: {
        coldStart: 'internal',
      },
      [EModalSignatureConfirmRoutes.MessageConfirmFromDApp]: {
        coldStart: 'internal',
      },
      [EModalSignatureConfirmRoutes.LnurlPayRequest]: {
        coldStart: 'internal',
      },
      [EModalSignatureConfirmRoutes.LnurlWithdraw]: {
        coldStart: 'internal',
      },
      [EModalSignatureConfirmRoutes.LnurlAuth]: {
        coldStart: 'internal',
      },
      [EModalSignatureConfirmRoutes.WeblnSendPayment]: {
        coldStart: 'internal',
      },
    },
  },
);

export const referFriendsRouteManifest = defineRouteManifest(
  Object.values(EModalReferFriendsRoutes),
  {
    overrides: {
      [EModalReferFriendsRoutes.ReferAFriend]: {
        coldStart: 'public',
      },
    },
  },
);

export const testModalRouteManifest = defineRouteManifest(
  Object.values(ETestModalPages),
  { defaults: { coldStart: 'internal' } },
);

const modalPresentation = Object.freeze<ERoutePresentation[]>(['modal']);
const modalAndFullScreenPresentations = Object.freeze<ERoutePresentation[]>([
  'modal',
  'iosFullScreen',
]);

export const modalRouteManifest = defineRouteManifest(
  Object.values(EModalRoutes),
  {
    defaults: {
      coldStart: 'internal',
      presentations: modalPresentation,
    },
    overrides: {
      [EModalRoutes.MainModal]: {
        children: rewardCenterRouteManifest,
      },
      [EModalRoutes.SettingModal]: {
        coldStart: 'public',
        rewrite: '/settings',
        exact: true,
        children: settingRouteManifest,
      },
      [EModalRoutes.AppUpdateModal]: {
        coldStart: 'public',
        rewrite: '/update',
        presentations: modalAndFullScreenPresentations,
        children: appUpdateRouteManifest,
      },
      [EModalRoutes.StakingModal]: {
        coldStart: 'public',
        children: stakingRouteManifest,
      },
      [EModalRoutes.ReferFriendsModal]: {
        coldStart: 'public',
        children: referFriendsRouteManifest,
      },
      [EModalRoutes.DAppConnectionModal]: {
        presentations: modalAndFullScreenPresentations,
        children: dAppConnectionRouteManifest,
      },
      [EModalRoutes.SignatureConfirmModal]: {
        presentations: modalAndFullScreenPresentations,
        children: signatureConfirmRouteManifest,
      },
      [EModalRoutes.ReceiveModal]: {
        presentations: modalAndFullScreenPresentations,
      },
      [EModalRoutes.SendModal]: {
        presentations: modalAndFullScreenPresentations,
      },
      [EModalRoutes.TestModal]: {
        children: testModalRouteManifest,
      },
    },
  },
);

export const onboardingRouteManifest = defineRouteManifest(
  [onboardingV2RouteConfig.name],
  {
    overrides: {
      [onboardingV2RouteConfig.name]: {
        coldStart: 'public',
        rewrite: onboardingV2RouteConfig.rewrite,
        exact: onboardingV2RouteConfig.exact,
        children: onboardingV2RouteConfig.children,
      },
    },
  },
);

export const actionCenterRouteManifest = defineRouteManifest(
  Object.values(EActionCenterPages),
  { defaults: { coldStart: 'internal' } },
);

export const fullScreenPushRouteManifest = defineRouteManifest(
  Object.values(EFullScreenPushRoutes),
  {
    defaults: { coldStart: 'internal' },
    overrides: {
      [EFullScreenPushRoutes.ActionCenter]: {
        children: actionCenterRouteManifest,
      },
    },
  },
);

export const webViewScreenRouteManifest = defineRouteManifest(
  Object.values(EWebViewRoutes),
  { defaults: { coldStart: 'internal' } },
);

export const webViewRouteManifest = defineRouteManifest(
  Object.values(EWebViewRoutes),
  {
    defaults: { coldStart: 'internal' },
    overrides: {
      [EWebViewRoutes.WebView]: {
        children: webViewScreenRouteManifest,
      },
    },
  },
);

export const rootRouteManifest = defineRouteManifest([
  ERootRoutes.Main,
  ERootRoutes.Onboarding,
  ERootRoutes.Modal,
  ERootRoutes.iOSFullScreen,
  ERootRoutes.FullScreenPush,
  ERootRoutes.WebView,
]);
