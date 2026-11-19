import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  IconButton,
  SegmentControl,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY } from '@onekeyhq/components/src/utils/animationConstants';
import { PendingIndicator } from '@onekeyhq/kit/src/views/Staking/components/StakingActivityIndicator';
import { HeaderRightView } from '@onekeyhq/kit/src/views/Staking/pages/ManagePosition/components/HeaderRight';
import type { IHeaderRightViewProps } from '@onekeyhq/kit/src/views/Staking/pages/ManagePosition/components/HeaderRight';
import { ManagePositionContent } from '@onekeyhq/kit/src/views/Staking/pages/ManagePosition/components/ManagePositionContent';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IBorrowReserveFormTab } from '@onekeyhq/shared/src/routes';
import { EManagePositionType } from '@onekeyhq/shared/types/staking';

import { BorrowReserveFormScopeContext } from '../../../components/ManagePosition/reserveFormScope';

import { getReserveSideForm, isHistoryCrowded } from './reserveFormSides';

import type { IBorrowReserveFormScope } from '../../../components/ManagePosition/reserveFormScope';
import type { LayoutChangeEvent } from 'react-native';

const SIDE_LABEL_IDS: Record<IBorrowReserveFormTab, ETranslations> = {
  supply: ETranslations.defi_supply,
  withdraw: ETranslations.global_withdraw,
  borrow: ETranslations.global_borrow,
  repay: ETranslations.defi_repay,
};

// As the manage form's own tabs: no track, the selected one on a flat block
// that slides between them
const TAB_ITEM_STYLE = {
  px: '$2',
  py: '$1.5',
  borderRadius: '$2',
} as const;

// Another side's form fades in where the last one was, as History does
const FADE_IN_STYLE = { opacity: 0 } as const;

// The least room kept between the switch and History; the History button
// reaches a little past its own box
const LINE_GAP = 16;

const readWidth = (event: LayoutChangeEvent) => event.nativeEvent.layout.width;

// History as an icon, its name on hover, where three or four sides leave no
// room for the word
function CompactHistory({
  pendingCount,
  showHistory,
  historyText,
  onHistory,
}: IHeaderRightViewProps) {
  if (pendingCount) {
    return <PendingIndicator num={pendingCount} onPress={onHistory} />;
  }
  if (!showHistory) {
    return null;
  }
  return (
    <IconButton
      testID="borrow-reserve-history-icon"
      icon="ClockTimeHistoryOutline"
      variant="tertiary"
      size="small"
      title={historyText}
      onPress={onHistory}
    />
  );
}

interface IManagePositionPartProps {
  accountId: string;
  indexedAccountId?: string;
  networkId: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
  symbol: string;
  logoURI?: string;
  // The market's name and logo ("Aave Core"), for the form's protocol
  marketLabel?: string;
  marketLogoURI?: string;
  // The sides the switch shows, and the one in use
  sides: IBorrowReserveFormTab[];
  side: IBorrowReserveFormTab;
  onSideChange: (side: IBorrowReserveFormTab) => void;
  // What the Loans window had typed, for the side it was typed for
  startAmount?: string;
  // What the account holds of the reserve, once read: the form lists no
  // zero position
  position?: IBorrowReserveFormScope['position'];
  onActionSuccess?: () => void;
}

/**
 * The reserve page's form column (demo 11-03), as the Earn lending page's:
 * a switch over the sides that apply, History beside it, and under it the
 * Borrow manage window's own form for that side, so its transactions,
 * approvals, checks and messages are the window's
 */
export const ManagePositionPart = ({
  accountId,
  indexedAccountId,
  networkId,
  provider,
  marketAddress,
  reserveAddress,
  symbol,
  logoURI,
  marketLabel,
  marketLogoURI,
  sides,
  side,
  onSideChange,
  startAmount,
  position,
  onActionSuccess,
}: IManagePositionPartProps) => {
  const intl = useIntl();
  // The form's History (or its pending count), drawn on the switch's line
  const [headerControls, setHeaderControls] =
    useState<IHeaderRightViewProps | null>(null);

  // History keeps its word while the line has room for it next to the
  // switch; the word's width is the one it last had
  const [lineWidth, setLineWidth] = useState(0);
  const [switchWidth, setSwitchWidth] = useState(0);
  const [fullHistoryWidth, setFullHistoryWidth] = useState(0);
  const handleLineLayout = useCallback((event: LayoutChangeEvent) => {
    setLineWidth(readWidth(event));
  }, []);
  const handleSwitchLayout = useCallback((event: LayoutChangeEvent) => {
    setSwitchWidth(readWidth(event));
  }, []);
  const handleHistoryLayout = useCallback((event: LayoutChangeEvent) => {
    setFullHistoryWidth(readWidth(event));
  }, []);
  const isHistoryCompact = isHistoryCrowded({
    lineWidth,
    switchWidth,
    historyWidth: fullHistoryWidth,
    gap: LINE_GAP,
  });

  const options = useMemo(
    () =>
      sides.map((item) => ({
        value: item,
        testID: `borrow-reserve-side-${item}`,
        label: (
          <SizableText
            size="$headingMd"
            color={item === side ? '$text' : '$textSubdued'}
            letterSpacing={-0.15}
            numberOfLines={1}
          >
            {intl.formatMessage({ id: SIDE_LABEL_IDS[item] })}
          </SizableText>
        ),
      })),
    [intl, side, sides],
  );
  const handleSideChange = useCallback(
    (value: string | number) => {
      const next = sides.find((item) => item === value);
      if (next && next !== side) {
        onSideChange(next);
      }
    },
    [onSideChange, side, sides],
  );

  const form = getReserveSideForm(side);
  // The form keeps to this reserve, and lists no zero position
  const formScope = useMemo<IBorrowReserveFormScope>(
    () => ({ position }),
    [position],
  );

  // Only History and the pending count fold into an icon; a form with
  // Pendle's slippage and refresh on the line keeps them all
  const foldsHistory = isHistoryCompact && !headerControls?.showPendleControls;
  let history = null;
  if (headerControls) {
    // Keyed apart: the two frames take different hooks (fade-in against
    // measuring), so one must not turn into the other
    history = foldsHistory ? (
      <XStack
        key="history-icon"
        ai="center"
        transition="quick"
        animateOnly={ANIMATE_ONLY_OPACITY}
        enterStyle={FADE_IN_STYLE}
      >
        <CompactHistory {...headerControls} />
      </XStack>
    ) : (
      <XStack key="history-word" onLayout={handleHistoryLayout}>
        <HeaderRightView {...headerControls} />
      </XStack>
    );
  }

  return (
    <YStack gap="$1.5">
      <XStack px="$5">
        <XStack flex={1} jc="space-between" onLayout={handleLineLayout}>
          <XStack flexShrink={0} onLayout={handleSwitchLayout}>
            <SegmentControl
              value={side}
              onChange={handleSideChange}
              options={options}
              slotBackgroundColor="$transparent"
              activeBackgroundColor="$bgActive"
              h="auto"
              p={0}
              gap="$1"
              borderRadius="$2"
              overflow="visible"
              segmentControlItemStyleProps={TAB_ITEM_STYLE}
            />
          </XStack>
          {history}
        </XStack>
      </XStack>
      <BorrowReserveFormScopeContext.Provider value={formScope}>
        <YStack
          key={side}
          testID={`borrow-reserve-form-${side}`}
          transition="quick"
          animateOnly={ANIMATE_ONLY_OPACITY}
          enterStyle={FADE_IN_STYLE}
        >
          <ManagePositionContent
            showApyDetail
            networkId={networkId}
            symbol={symbol}
            provider={provider}
            type={form.type}
            marketAddress={marketAddress}
            reserveAddress={reserveAddress}
            accountId={accountId}
            indexedAccountId={indexedAccountId}
            fallbackTokenImageUri={logoURI}
            providerDisplayName={marketLabel}
            providerLogoUri={marketLogoURI}
            depositOnly={form.depositOnly}
            withdrawOnly={form.withdrawOnly}
            // A withdrawal keeps to this reserve, in the Earn forms' look
            isEarnLending={form.type === EManagePositionType.Supply}
            initialAmount={startAmount}
            hidesTabLine
            onHeaderRightChange={setHeaderControls}
            onStakeWithdrawSuccess={onActionSuccess}
          />
        </YStack>
      </BorrowReserveFormScopeContext.Provider>
    </YStack>
  );
};
