import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  DebugRenderTracker,
  Divider,
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
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';

import { usePerpsAssetCtx } from '../../../hooks/usePerpsAssetCtx';
import { usePerpsMidPrice } from '../../../hooks/usePerpsMidPrice';
import { useShowDepositWithdrawModal } from '../../../hooks/useShowDepositWithdrawModal';
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
  const { showDepositWithdrawModal } = useShowDepositWithdrawModal();

  if (!activeAccount?.accountAddress) {
    return null;
  }

  const isEmptyAccount = !accountValue || new BigNumber(accountValue).lte(0);
  const content = (
    <Badge
      borderRadius="$full"
      size="medium"
      variant={isEmptyAccount ? 'primary' : 'secondary'}
      onPress={async () => {
        await showDepositWithdrawModal('deposit');
      }}
      alignItems="center"
      justifyContent="center"
      flexDirection="row"
      gap="$2"
      px="$3"
      h={gtSm ? 30 : 28}
      bg={isEmptyAccount ? '$brand8' : '$bgStrong'}
      cursor="pointer"
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
          {gtSm ? (
            <SizableText size="$bodySmMedium" color="$text">
              {intl.formatMessage({ id: ETranslations.perp_trade_deposit })}
            </SizableText>
          ) : (
            <PerpsAccountNumberValue
              value={accountValue ?? ''}
              skeletonWidth={60}
              textSize="$bodySmMedium"
            />
          )}
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

export function PerpsHeaderRight() {
  const { gtMd } = useMedia();
  const content = (
    <XStack alignItems="center" gap="$5">
      <WalletConnectionForWeb tabRoute={ETabRoutes.Perp} />
      {process.env.NODE_ENV !== 'production' ? <DebugButton /> : null}
      <DepositButton />
      {gtMd ? (
        <PerpSettingsButton testID="perp-header-settings-button" />
      ) : null}
    </XStack>
  );
  return (
    <DebugRenderTracker name="PerpsHeaderRight" position="bottom-center">
      {content}
    </DebugRenderTracker>
  );
}
