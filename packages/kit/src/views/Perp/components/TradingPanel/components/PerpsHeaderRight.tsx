import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  DebugRenderTracker,
  Icon,
  IconButton,
  SizableText,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { WalletConnectionForWeb } from '@onekeyhq/kit/src/components/TabPageHeader/components/WalletConnectionGroup';
import {
  usePerpsActiveOpenOrdersAtom,
  usePerpsActivePositionAtom,
  usePerpsAllAssetCtxsAtom,
  usePerpsAllMidsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { useShowPortfolio } from '@onekeyhq/kit/src/views/Perp/hooks/useShowPortfolio';
import {
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountIsAgentReadyAtom,
  usePerpsActiveAccountStatusAtom,
  usePerpsActiveAccountSummaryAtom,
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetCtxAtom,
  usePerpsActiveAssetDataAtom,
  usePerpsActiveOrderBookOptionsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';

import { usePerpsAssetCtx } from '../../../hooks/usePerpsAssetCtx';
import { usePerpsMidPrice } from '../../../hooks/usePerpsMidPrice';
import { useShowGuide } from '../../../hooks/useShowGuide';
import { PerpGuidePopover } from '../../Guide/PerpGuidePopover';
import { PerpsActivityCenterAction } from '../../PerpsActivityCenterAction';
import { PerpSettingsButton } from '../../PerpSettingsButton';

import { PerpsAccountNumberValue } from './PerpsAccountNumberValue';

function DebugButton() {
  const [allMids] = usePerpsAllMidsAtom();
  const [allAssetCtxs] = usePerpsAllAssetCtxsAtom();
  const { assetCtx: btcAssetCtx } = usePerpsAssetCtx({ assetId: 0 });
  const { mid: btcMid, midFormattedByDecimals: btcMidFormattedByDecimals } =
    usePerpsMidPrice({ coin: 'BTC' });

  const [activeAccount] = usePerpsActiveAccountAtom();
  const [activeAccountSummary] = usePerpsActiveAccountSummaryAtom();
  const [activeAccountStatus] = usePerpsActiveAccountStatusAtom();
  const [{ isAgentReady }] = usePerpsActiveAccountIsAgentReadyAtom();
  const [activeAsset] = usePerpsActiveAssetAtom();
  const [activeAssetCtx] = usePerpsActiveAssetCtxAtom();
  const [activeAssetData] = usePerpsActiveAssetDataAtom();
  const [activeOpenOrders] = usePerpsActiveOpenOrdersAtom();
  const [activePositions] = usePerpsActivePositionAtom();
  const [activeOrderBookOptions] = usePerpsActiveOrderBookOptionsAtom();

  return (
    <DebugRenderTracker name="PerpsHeaderRight__DebugButton">
      <IconButton
        icon="BugSolid"
        size="small"
        variant="tertiary"
        onPress={async () => {
          const simpleDbPerpData =
            await backgroundApiProxy.simpleDb.perp.getPerpData();
          console.log('PerpsHeaderRight__DebugButton', {
            simpleDbPerpData,
            allMids,
            allAssetCtxs,
            btcAssetCtx,
            btcMidFormattedByDecimals,
            btcMid,
            activeAccount,
            activeAccountSummary,
            activeAsset,
            activeAssetCtx,
            activeAssetData,
            activeOpenOrders,
            activePositions,
            activeOrderBookOptions,
            activeAccountStatus,
            isAgentReady,
          });
        }}
      />
    </DebugRenderTracker>
  );
}

function DepositButton() {
  const { gtSm } = useMedia();
  const [accountSummary] = usePerpsActiveAccountSummaryAtom();
  const accountValue = accountSummary?.accountValue;
  const intl = useIntl();
  const [activeAccount] = usePerpsActiveAccountAtom();
  const { showPortfolio } = useShowPortfolio();

  if (!activeAccount?.accountAddress) {
    return null;
  }

  const isEmptyAccount = !accountValue || new BigNumber(accountValue).lte(0);
  const content = (
    <Badge
      borderRadius="$full"
      size="medium"
      variant={isEmptyAccount ? 'primary' : 'secondary'}
      onPress={showPortfolio}
      alignItems="center"
      justifyContent="center"
      flexDirection="row"
      gap="$2"
      px="$3"
      h={gtSm ? 30 : 28}
      bg={isEmptyAccount ? '$brand8' : '$bgStrong'}
      cursor="default"
    >
      {isEmptyAccount ? (
        <>
          <Icon name="AlignBottomOutline" size="$4" color="$iconOnColor" />
          <SizableText size="$bodySmMedium" color="$textOnColor">
            {intl.formatMessage({ id: ETranslations.perp_trade_deposit })}
          </SizableText>
        </>
      ) : (
        <>
          <Icon name="ChartLine2Outline" size="$4" />
          <PerpsAccountNumberValue
            value={accountValue ?? ''}
            skeletonWidth={60}
            textSize="$bodySmMedium"
          />
        </>
      )}
    </Badge>
  );
  return (
    <DebugRenderTracker name="PerpsHeaderRight__DepositButton">
      {content}
    </DebugRenderTracker>
  );
}

function MobileGuideButton() {
  const { showGuide } = useShowGuide();
  return (
    <IconButton
      icon="BookOpenOutline"
      size="small"
      variant="tertiary"
      cursor="default"
      onPress={showGuide}
    />
  );
}

export function PerpsHeaderRight() {
  const { gtMd } = useMedia();
  const content = (
    <XStack alignItems="center" gap="$5">
      <WalletConnectionForWeb tabRoute={ETabRoutes.Perp} />
      {process.env.NODE_ENV !== 'production' ? <DebugButton /> : null}
      <DepositButton />
      {(() => {
        if (platformEnv.isWebDappMode) return null;
        if (gtMd) {
          return (
            <>
              <PerpsActivityCenterAction copyAsUrl />
              <PerpGuidePopover />
              <PerpSettingsButton testID="perp-header-settings-button" />
            </>
          );
        }
        return <MobileGuideButton />;
      })()}
    </XStack>
  );
  return (
    <DebugRenderTracker name="PerpsHeaderRight" position="bottom-center">
      {content}
    </DebugRenderTracker>
  );
}
