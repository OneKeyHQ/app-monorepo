import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack, useInPageDialog } from '@onekeyhq/components';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  getPerpsAccountDisplaySnapshotEntry,
  usePerpsAccountDisplaySnapshotAtom,
  usePerpsActiveAccountAtom,
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetDataAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PerpTestIDs } from '../../../testIDs';
import { showMarginModeDialog } from '../modals/MarginModeModal';

interface IMarginModeSelectorProps {
  disabled?: boolean;
  isMobile?: boolean;
}

const MarginModeSelector = ({
  disabled = false,
  isMobile = false,
}: IMarginModeSelectorProps) => {
  const intl = useIntl();
  const [activeAssetData] = usePerpsActiveAssetDataAtom();
  const [selectedSymbol] = usePerpsActiveAssetAtom();
  const [perpsActiveAccount] = usePerpsActiveAccountAtom();
  const [displaySnapshot] = usePerpsAccountDisplaySnapshotAtom();
  const { activeAccount: selectedWalletAccount } = useActiveAccount({ num: 0 });
  const snapshotLookupIndexedAccountId = selectedWalletAccount.ready
    ? selectedWalletAccount.indexedAccount?.id
    : perpsActiveAccount?.indexedAccountId;
  const snapshotLookupAccountId = selectedWalletAccount.ready
    ? selectedWalletAccount.account?.id
    : perpsActiveAccount?.accountId;
  const snapshotLookupAccountAddress =
    !selectedWalletAccount.ready ||
    snapshotLookupIndexedAccountId ||
    snapshotLookupAccountId
      ? perpsActiveAccount?.accountAddress
      : undefined;
  const snapshotEntry = useMemo(
    () =>
      getPerpsAccountDisplaySnapshotEntry({
        snapshot: displaySnapshot,
        accountAddress: snapshotLookupAccountAddress,
        indexedAccountId: snapshotLookupIndexedAccountId,
        accountId: snapshotLookupAccountId,
        deriveType:
          selectedWalletAccount.deriveType ?? perpsActiveAccount.deriveType,
      }),
    [
      displaySnapshot,
      perpsActiveAccount?.deriveType,
      selectedWalletAccount.deriveType,
      snapshotLookupAccountAddress,
      snapshotLookupAccountId,
      snapshotLookupIndexedAccountId,
    ],
  );
  const liveMode =
    activeAssetData?.coin === selectedSymbol?.coin
      ? activeAssetData?.leverage?.type
      : undefined;
  const cachedMode =
    snapshotEntry?.activeAsset?.coin === selectedSymbol?.coin
      ? snapshotEntry.activeAsset.leverage?.type
      : undefined;
  const isReadyForInteraction = Boolean(liveMode && activeAssetData);

  const currentModeLabel = useMemo(() => {
    const currentMode = liveMode || cachedMode || 'isolated';
    return currentMode === 'cross'
      ? intl.formatMessage({ id: ETranslations.perp_trade_cross })
      : intl.formatMessage({ id: ETranslations.perp_trade_isolated });
  }, [cachedMode, intl, liveMode]);

  const dialog = useInPageDialog();

  const handlePress = () => {
    if (disabled || !isReadyForInteraction) return;
    showMarginModeDialog(selectedSymbol?.coin, intl, dialog);
  };

  return (
    <XStack
      testID={PerpTestIDs.MarginModeSelector}
      onPress={handlePress}
      disabled={disabled || !isReadyForInteraction}
      width="100%"
      height={isMobile ? 32 : 30}
      bg={isMobile ? '$bgSubdued' : '$bgStrong'}
      borderRadius="$2"
      alignItems="center"
      justifyContent="center"
      px="$3"
      cursor="default"
      hoverStyle={{
        bg: '$bgStrongHover',
      }}
      pressStyle={{
        bg: '$bgStrongActive',
      }}
    >
      <SizableText size="$bodyMdMedium">{currentModeLabel}</SizableText>
    </XStack>
  );
};

MarginModeSelector.displayName = 'MarginModeSelector';

export { MarginModeSelector };
