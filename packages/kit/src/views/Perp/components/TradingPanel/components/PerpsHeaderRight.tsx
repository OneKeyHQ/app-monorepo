import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  DebugRenderTracker,
  Divider,
  Icon,
  SizableText,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePerpsAllMidsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveAccountSummaryAtom,
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetCtxAtom,
  usePerpsActiveAssetDataAtom,
  usePerpsCurrentMidAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { PerpSettingsButton } from '../../PerpSettingsButton';
import { showDepositWithdrawModal } from '../modals/DepositWithdrawModal';

import { PerpsAccountNumberValue } from './PerpsAccountNumberValue';

function DebugButton() {
  const [allMids] = usePerpsAllMidsAtom();
  const [selectedSymbol] = usePerpsActiveAssetAtom();
  const [currentMid] = usePerpsCurrentMidAtom();
  const [activeAssetData] = usePerpsActiveAssetDataAtom();
  const [activeAssetCtxGlobal] = usePerpsActiveAssetCtxAtom();
  const [activeAccountSummary] = usePerpsActiveAccountSummaryAtom();
  return (
    <DebugRenderTracker name="PerpsHeaderRight__DebugButton">
      <Button
        onPress={async () => {
          const perpData = await backgroundApiProxy.simpleDb.perp.getPerpData();
          const hyperLiquidCache =
            await backgroundApiProxy.serviceHyperliquid.getHyperLiquidCache();
          console.log('PerpsHeaderRight__DebugButton', {
            currentMid,
            perpData,
            allMids,
            selectedSymbol,
            hyperLiquidCache,
            activeAssetCtxGlobal,
            activeAccountSummary,
            activeAssetData,
          });
        }}
      >
        Debug
      </Button>
    </DebugRenderTracker>
  );
}

export function PerpsHeaderRight() {
  const [accountSummary] = usePerpsActiveAccountSummaryAtom();
  const { gtSm } = useMedia();
  const accountValue = accountSummary?.accountValue;
  const intl = useIntl();
  return (
    <XStack alignItems="center" gap="$5">
      {process.env.NODE_ENV !== 'production' ? <DebugButton /> : null}
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
      {platformEnv.isNative ? null : (
        <PerpSettingsButton testID="perp-header-settings-button" />
      )}
    </XStack>
  );
}
