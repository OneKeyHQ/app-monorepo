import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  DebugRenderTracker,
  Divider,
  Icon,
  IconButton,
  SizableText,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  usePerpsActiveOpenOrdersAtom,
  usePerpsActivePositionAtom,
  usePerpsAllAssetCtxsAtom,
  usePerpsAllMidsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountSummaryAtom,
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetCtxAtom,
  usePerpsActiveAssetDataAtom,
  usePerpsCurrentMidAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { usePerpsAssetCtx } from '../../../hooks/usePerpsAssetCtx';
import { usePerpsMidPrice } from '../../../hooks/usePerpsMidPrice';
import { PerpSettingsButton } from '../../PerpSettingsButton';
import { showDepositWithdrawModal } from '../modals/DepositWithdrawModal';

import { PerpsAccountNumberValue } from './PerpsAccountNumberValue';

function DebugButton() {
  const [currentMid] = usePerpsCurrentMidAtom(); // TODO remove
  const [allMids] = usePerpsAllMidsAtom();
  const [allAssetCtxs] = usePerpsAllAssetCtxsAtom();
  const { assetCtx: btcAssetCtx } = usePerpsAssetCtx({ assetId: 0 });
  const { mid: btcMid, midFormattedByDecimals: btcMidFormattedByDecimals } =
    usePerpsMidPrice({ coin: 'BTC', szDecimals: 2 });

  const [activeAccount] = usePerpsActiveAccountAtom();
  const [activeAccountSummary] = usePerpsActiveAccountSummaryAtom();
  const [activeAsset] = usePerpsActiveAssetAtom();
  const [activeAssetCtx] = usePerpsActiveAssetCtxAtom();
  const [activeAssetData] = usePerpsActiveAssetDataAtom();
  const [activeOpenOrders] = usePerpsActiveOpenOrdersAtom();
  const [activePositions] = usePerpsActivePositionAtom();

  return (
    <DebugRenderTracker name="PerpsHeaderRight__DebugButton">
      <IconButton
        icon="BugSolid"
        size="small"
        variant="tertiary"
        onPress={async () => {
          const simpleDbPerpData =
            await backgroundApiProxy.simpleDb.perp.getPerpData();
          const bgHyperLiquidCache =
            await backgroundApiProxy.serviceHyperliquid.getHyperLiquidCache();
          console.log('PerpsHeaderRight__DebugButton', {
            simpleDbPerpData,
            bgHyperLiquidCache,
            currentMid,
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

  const content = activeAccount.accountAddress ? (
    <Badge
      borderRadius="$full"
      size="medium"
      variant="secondary"
      onPress={() =>
        showDepositWithdrawModal({
          actionType: 'deposit',
          withdrawable: accountSummary?.withdrawable || '0',
        })
      }
      alignItems="center"
      justifyContent="center"
      flexDirection="row"
      gap="$2"
      px="$3"
      h={32}
      hoverStyle={{
        bg: '$bgStrongHover',
      }}
      pressStyle={{
        bg: '$bgStrongActive',
      }}
      cursor="pointer"
    >
      <Icon name="WalletOutline" size="$4" />

      {gtSm ? (
        <PerpsAccountNumberValue
          value={accountValue ?? ''}
          skeletonWidth={60}
          textSize="$bodySmMedium"
        />
      ) : null}
      <Divider
        borderWidth={0.33}
        borderBottomWidth={12}
        borderColor="$borderSubdued"
      />
      <SizableText size="$bodySmMedium" color="$text">
        {intl.formatMessage({ id: ETranslations.perp_trade_deposit })}
      </SizableText>
    </Badge>
  ) : null;
  return (
    <DebugRenderTracker name="PerpsHeaderRight__DepositButton">
      {content}
    </DebugRenderTracker>
  );
}

export function PerpsHeaderRight() {
  const content = (
    <XStack alignItems="center" gap="$5">
      {process.env.NODE_ENV !== 'production' ? <DebugButton /> : null}
      <DepositButton />
      {platformEnv.isNative ? null : (
        <PerpSettingsButton testID="perp-header-settings-button" />
      )}
    </XStack>
  );
  return (
    <DebugRenderTracker name="PerpsHeaderRight" position="bottom-center">
      {content}
    </DebugRenderTracker>
  );
}
