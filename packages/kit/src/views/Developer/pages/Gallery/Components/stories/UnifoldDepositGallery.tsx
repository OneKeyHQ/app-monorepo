// cspell: words unifold Unifold hypercore Hypercore arbiscan
import { useState } from 'react';

import {
  Button,
  Icon,
  ScrollView,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { UnifoldDepositQRCard } from '@onekeyhq/kit/src/views/Perp/components/TradingPanel/modals/UnifoldDeposit/UnifoldDepositQRCard';
import { UnifoldExecutionStatusCards } from '@onekeyhq/kit/src/views/Perp/components/TradingPanel/modals/UnifoldDeposit/UnifoldExecutionStatusCards';
import {
  formatUnifoldTokenAmount,
  formatUnifoldUsd,
} from '@onekeyhq/kit/src/views/Perp/components/TradingPanel/modals/UnifoldDeposit/unifoldFormat';
import { UnifoldSourceSelector } from '@onekeyhq/kit/src/views/Perp/components/TradingPanel/modals/UnifoldDeposit/UnifoldSourceSelector';
import {
  UnifoldExecutionDetail,
  UnifoldExecutionRow,
} from '@onekeyhq/kit/src/views/Perp/components/TradingPanel/modals/UnifoldDeposit/UnifoldTrackerContent';
import type {
  IUnifoldDepositExecution,
  IUnifoldSupportedAsset,
} from '@onekeyhq/shared/types/unifoldDeposit';

import { Layout } from './utils/Layout';

// Fixtures only — this gallery renders the Unifold deposit surfaces with no
// network access, so every state (including ones that are hard to reproduce
// with real money: failed, refunded, null amounts, multi-deposit sessions)
// can be reviewed on every platform before shipping.

const USDC_ICON = 'https://api.unifold.io/api/public/icons/tokens/svg/usdc.svg';
// Chain icons live under /networks/, not /chains/ — the wrong path 404s and
// the QR centre logo renders as a broken image.
const ARB_ICON =
  'https://api.unifold.io/api/public/icons/networks/svg/arbitrum.svg';
const TX = '0x41f367d5a06097f392e2b3d88cc0170a41fce6b20d46bd552145a7d5af87d592';

// Verbatim payload from a real Arbitrum deposit (2026-07-22).
const SUCCEEDED: IUnifoldDepositExecution = {
  executionId: 'exec_3GqnYvwsMohxctAkCMbfviym165',
  status: 'succeeded',
  vendorStatus: 'succeeded',
  terminal: true,
  recipientAddress: '0x8de690f962af4d26263060bcf4cf61c1353c8eb0',
  depositWalletId: 'wallet_3GqnPXYCXi8gg69XyS6etMfBHWs',
  depositAddress: '0x1c30fdd3bb555dd594d92cbcf37dedaa327043b1',
  transactionHash: TX,
  destinationTransactionHashes: [TX],
  sourceChainType: 'ethereum',
  sourceChainId: '42161',
  sourceAmountBaseUnit: '3300000',
  sourceAmountUsd: '3.29960100000000000000',
  sourceCurrency: 'usdc',
  sourceTokenDecimals: 6,
  destinationAmountBaseUnit: '3300000',
  destinationAmountUsd: '3.29960100000000000000',
  destinationCurrency: 'usdc',
  destinationTokenDecimals: 6,
  destinationTokenIconUrl: USDC_ICON,
  explorerUrl: `https://arbiscan.io/tx/${TX}`,
  destinationExplorerUrl: `https://arbiscan.io/tx/${TX}`,
  failureReason: null,
  createdAt: '2026-07-22T08:13:37.181Z',
};

// Pre-terminal: destination amounts are null by contract, so every amount on
// the destination side must render as an em dash, never as 0.
const PENDING: IUnifoldDepositExecution = {
  ...SUCCEEDED,
  executionId: 'exec_pending_0001',
  status: 'pending',
  vendorStatus: 'pending',
  terminal: false,
  destinationAmountBaseUnit: null,
  destinationAmountUsd: null,
  destinationExplorerUrl: null,
  destinationTransactionHashes: [],
  createdAt: '2026-07-22T08:20:00.000Z',
};

// Delayed must never be presented as a failure (contract §1).
const DELAYED: IUnifoldDepositExecution = {
  ...PENDING,
  executionId: 'exec_delayed_0002',
  status: 'delayed',
  vendorStatus: 'delayed',
  createdAt: '2026-07-22T08:05:00.000Z',
};

const WAITING_MINIMAL: IUnifoldDepositExecution = {
  ...PENDING,
  executionId: 'exec_waiting_0003',
  status: 'waiting',
  vendorStatus: 'waiting',
  // Worst case allowed by the contract: everything nullable is null.
  transactionHash: null,
  sourceChainId: null,
  sourceAmountBaseUnit: null,
  sourceAmountUsd: null,
  sourceCurrency: null,
  sourceTokenDecimals: null,
  destinationCurrency: null,
  destinationTokenIconUrl: null,
  explorerUrl: null,
  createdAt: null,
};

const FAILED: IUnifoldDepositExecution = {
  ...SUCCEEDED,
  executionId: 'exec_failed_0004',
  status: 'failed',
  vendorStatus: 'failed',
  terminal: true,
  destinationAmountBaseUnit: null,
  destinationAmountUsd: null,
  destinationExplorerUrl: null,
  destinationTransactionHashes: [],
  createdAt: '2026-07-22T07:40:00.000Z',
};

const REFUNDED: IUnifoldDepositExecution = {
  ...FAILED,
  executionId: 'exec_refunded_0005',
  status: 'refunded',
  vendorStatus: 'refunded',
};

// Large value guards the card layout against the amount column squeezing the
// title/date (the bug seen on the first live deposit).
const LARGE_AMOUNT: IUnifoldDepositExecution = {
  ...SUCCEEDED,
  executionId: 'exec_large_0006',
  sourceAmountUsd: '123456.78901234567890',
  destinationAmountUsd: '123456.78901234567890',
  sourceAmountBaseUnit: '123456789012',
  destinationAmountBaseUnit: '123456789012',
};

// Amount edge cases. The vendor sends raw decimal strings, so the display
// layer has to survive zero, sub-cent, negative (refunds), huge values and
// non-numeric junk without ever showing a misleading 0.
const AMOUNT_EDGE_CASES: Array<[string, string | null]> = [
  ['real payload', '3.29960100000000000000'],
  ['plain 2dp', '2.00'],
  ['zero', '0'],
  ['sub-cent', '0.0000001'],
  ['just under a cent', '0.009'],
  ['rounds up', '0.005'],
  ['negative (refund)', '-3.5'],
  ['huge', '999999999.999999'],
  ['scientific notation', '1e-7'],
  ['non-numeric junk', 'abc'],
  ['empty string', ''],
  ['null', null],
];

const TOKEN_AMOUNT_EDGE_CASES: Array<
  [
    string,
    {
      baseUnit: string | null;
      decimals: number | null;
      currency: string | null;
    },
  ]
> = [
  ['USDC 6dp', { baseUnit: '3300000', decimals: 6, currency: 'usdc' }],
  ['USDC dust', { baseUnit: '1', decimals: 6, currency: 'usdc' }],
  [
    '18dp token',
    { baseUnit: '1234567890123456789', decimals: 18, currency: 'dai' },
  ],
  ['18dp wei dust', { baseUnit: '1', decimals: 18, currency: 'dai' }],
  ['8dp BTC-like', { baseUnit: '100000000', decimals: 8, currency: 'cbbtc' }],
  [
    'huge supply',
    { baseUnit: '123456789012345678', decimals: 6, currency: 'usdt' },
  ],
  ['zero', { baseUnit: '0', decimals: 6, currency: 'usdc' }],
  [
    'missing decimals',
    { baseUnit: '3300000', decimals: null, currency: 'usdc' },
  ],
  ['missing baseUnit', { baseUnit: null, decimals: 6, currency: 'usdc' }],
  ['missing currency', { baseUnit: '3300000', decimals: 6, currency: null }],
];

const ZERO_AMOUNT: IUnifoldDepositExecution = {
  ...SUCCEEDED,
  executionId: 'exec_zero_0007',
  sourceAmountUsd: '0',
  destinationAmountUsd: '0',
  sourceAmountBaseUnit: '0',
  destinationAmountBaseUnit: '0',
};

const SUB_CENT_AMOUNT: IUnifoldDepositExecution = {
  ...SUCCEEDED,
  executionId: 'exec_subcent_0008',
  sourceAmountUsd: '0.0000001',
  destinationAmountUsd: '0.0000001',
  sourceAmountBaseUnit: '1',
  destinationAmountBaseUnit: '1',
};

const NEGATIVE_AMOUNT: IUnifoldDepositExecution = {
  ...REFUNDED,
  executionId: 'exec_negative_0009',
  sourceAmountUsd: '-3.5',
  destinationAmountUsd: '-3.5',
};

const SESSION_ID = 'f70547b3-490f-41ba-9799-9dab91d89221';

const SUPPORTED_ASSETS: IUnifoldSupportedAsset[] = [
  {
    symbol: 'USDC',
    name: 'USD Coin',
    icon_url: USDC_ICON,
    is_newly_added: false,
    is_stablecoin: true,
    chains: [
      {
        chain_id: '42161',
        chain_name: 'Arbitrum',
        chain_type: 'ethereum',
        icon_url: ARB_ICON,
        token_address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        decimals: 6,
        estimated_price_impact_percent: 0,
        max_slippage_percent: 0.25,
        estimated_processing_time: 60,
        minimum_deposit_amount_usd: 3,
      },
      {
        chain_id: '1',
        chain_name: 'Ethereum',
        chain_type: 'ethereum',
        icon_url: ARB_ICON,
        token_address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        decimals: 6,
        estimated_price_impact_percent: 0.1,
        max_slippage_percent: 0.25,
        estimated_processing_time: 300,
        minimum_deposit_amount_usd: 10,
      },
    ],
  },
];

const SELECTION = {
  asset: SUPPORTED_ASSETS[0],
  chain: SUPPORTED_ASSETS[0].chains[0],
};

// Production widths: the desktop dialog gives the body 360pt (400 panel − 2×$5)
// and a 375pt phone gives 343pt (− 2×$4). Fixtures that render at the gallery's
// default width never squeeze, which is how the overlap bug stayed invisible.
const DESKTOP_BODY_WIDTH = 360;
const MOBILE_BODY_WIDTH = 343;

// Stand-ins for the two rows the overlay is most likely to cover. Kept
// visually identical to UnifoldTransferContent's real ones.
function ProcessingTimeRowStub() {
  return (
    <YStack>
      <XStack
        minHeight="$12"
        alignItems="center"
        justifyContent="space-between"
        gap="$3"
      >
        <SizableText size="$bodySm" color="$textSubdued">
          Deposit details
        </SizableText>
        <XStack alignItems="center" gap="$1.5">
          <SizableText size="$bodySmMedium" color="$text">
            {'< 1 min'}
          </SizableText>
          <Icon name="ChevronDownSmallOutline" size="$4" color="$iconSubdued" />
        </XStack>
      </XStack>
    </YStack>
  );
}

function TermsRowStub({ waiting }: { waiting?: boolean }) {
  return (
    <XStack alignItems="center" justifyContent="space-between">
      <XStack alignItems="center" gap="$1.5">
        {waiting ? (
          <>
            <Spinner size="small" scale={0.65} />
            <SizableText size="$bodySm" color="$textSubdued">
              Checking for deposit
            </SizableText>
          </>
        ) : null}
      </XStack>
      <XStack alignItems="center" gap="$1.5">
        <Button size="small" variant="tertiary" childrenAsText={false} px="$2">
          <SizableText size="$bodySm" color="$textInfo">
            Terms
          </SizableText>
        </Button>
        <Button size="small" variant="tertiary" childrenAsText={false} px="$2">
          <SizableText size="$bodySm" color="$textInfo">
            Help
          </SizableText>
        </Button>
      </XStack>
    </XStack>
  );
}

function ActivationWarningStub() {
  return (
    <XStack
      bg="$bgCautionSubdued"
      borderWidth="$px"
      borderColor="$borderCautionSubdued"
      borderRadius="$3"
      p="$3"
      gap="$2"
      alignItems="center"
    >
      <Icon name="ErrorOutline" size="$4" color="$iconCaution" />
      <SizableText size="$bodySm" color="$textCaution" flex={1}>
        ~$1 fee is required to activate a new HyperCore account.
      </SizableText>
    </XStack>
  );
}

// Reproduces the real Transfer panel geometry: same body, same overlay, same
// measured reservation. UnifoldTransferContent itself cannot be mounted here
// (it calls the session hook: network + jotai), so the body is composed from
// the same presentational pieces.
function PanelFrame({
  title,
  width = DESKTOP_BODY_WIDTH,
  maxHeight,
  executions,
  sessionId,
  expanded,
  activationWarning,
  qrLoading,
  qrAddress = '0x1c30fdd3bb555dd594d92cbcf37dedaa327043b1',
  selectorLoading,
  onDismiss,
}: {
  title: string;
  width?: number;
  maxHeight?: number;
  executions: IUnifoldDepositExecution[];
  sessionId?: string | null;
  expanded?: boolean;
  activationWarning?: boolean;
  qrLoading?: boolean;
  qrAddress?: string | null;
  selectorLoading?: boolean;
  onDismiss?: (executionId: string) => void;
}) {
  const [cardsHeight, setCardsHeight] = useState(0);
  const reserve = executions.length ? cardsHeight : undefined;
  const body = (
    <Stack pb={reserve}>
      <YStack gap="$3">
        <UnifoldSourceSelector
          assets={selectorLoading ? undefined : SUPPORTED_ASSETS}
          selection={selectorLoading ? null : SELECTION}
          loading={Boolean(selectorLoading)}
          onSelectToken={() => {}}
          onSelectChain={() => {}}
        />
        <UnifoldDepositQRCard
          address={qrAddress}
          chainIconUri={ARB_ICON}
          loading={Boolean(qrLoading)}
        />
        <ProcessingTimeRowStub />
        {expanded ? (
          <YStack gap="$2.5" px="$2.5">
            <SizableText size="$bodySm" color="$textSubdued">
              Max slippage: Auto • 0.25%
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued">
              Price impact: 0.10%
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued">
              Recipient address: 0x8de690f9…3c8eb0
            </SizableText>
          </YStack>
        ) : null}
        {activationWarning ? <ActivationWarningStub /> : null}
        <TermsRowStub waiting={!executions.length} />
      </YStack>
    </Stack>
  );

  return (
    <YStack gap="$2">
      <SizableText size="$bodySmMedium" color="$textSubdued">
        {title}
      </SizableText>
      <Stack
        width={width}
        borderWidth="$px"
        borderColor="$borderSubdued"
        borderRadius="$3"
        p="$2"
        overflow="hidden"
      >
        <Stack>
          {maxHeight === undefined ? (
            <Stack>{body}</Stack>
          ) : (
            <ScrollView maxHeight={maxHeight}>{body}</ScrollView>
          )}
          {executions.length ? (
            <UnifoldExecutionStatusCards
              executions={executions}
              // `??` would swallow an explicit null (the no-sessionId case),
              // so only default when the prop is omitted entirely.
              sessionId={sessionId === undefined ? SESSION_ID : sessionId}
              estimatedProcessingTimeSeconds={60}
              onDismiss={onDismiss ?? (() => {})}
              onHeightChange={setCardsHeight}
            />
          ) : null}
        </Stack>
      </Stack>
    </YStack>
  );
}

// A frame that owns dismissal, so the "executions present, nothing visible"
// state (which used to leave a dead reserved gap) is reachable here.
function DismissiblePanelFrame() {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const executions = [SUCCEEDED, DELAYED, PENDING].filter(
    (item) => !dismissed.includes(item.executionId),
  );
  return (
    <YStack gap="$2">
      <PanelFrame
        title="Dismissible · reservation must follow the visible cards"
        executions={executions}
        onDismiss={(id) => setDismissed((prev) => [...prev, id])}
      />
      <Button
        size="small"
        alignSelf="flex-start"
        onPress={() => setDismissed([])}
      >
        Reset dismissed
      </Button>
    </YStack>
  );
}

function StatusCardCase({
  title,
  executions,
  sessionId,
}: {
  title: string;
  executions: IUnifoldDepositExecution[];
  sessionId?: string | null;
}) {
  const [cardsHeight, setCardsHeight] = useState(0);
  return (
    <YStack gap="$2">
      <SizableText size="$bodySmMedium" color="$textSubdued">
        {title}
      </SizableText>
      {/* The real cards are absolutely positioned at the bottom of the modal;
          this frame reproduces that container, sized by the measured overlay
          height exactly like the real panel reserves it. */}
      <Stack
        height={Math.max(cardsHeight, 24) + 16}
        bg="$bgSubdued"
        borderRadius="$3"
      >
        <UnifoldExecutionStatusCards
          executions={executions}
          // `??` would swallow an explicit null (the no-sessionId case), so
          // only default when the prop is omitted entirely.
          sessionId={sessionId === undefined ? SESSION_ID : sessionId}
          estimatedProcessingTimeSeconds={60}
          onDismiss={() => {}}
          onHeightChange={setCardsHeight}
        />
      </Stack>
    </YStack>
  );
}

// The composite section: the overlay meeting real content, at production
// width. Every case here exists because an isolated fixture could not have
// shown the defect.
function CompositePanelGallery() {
  const noLinks: IUnifoldDepositExecution = {
    ...FAILED,
    explorerUrl: null,
    transactionHash: null,
    destinationExplorerUrl: null,
    destinationTransactionHashes: [],
  };
  return (
    <YStack gap="$6">
      <PanelFrame title="Desktop 360pt · no deposits" executions={[]} />
      <PanelFrame
        title="Desktop 360pt · 1 card (must not cover Terms | Help)"
        executions={[SUCCEEDED]}
      />
      <PanelFrame
        title="Desktop 360pt · 2 cards"
        executions={[SUCCEEDED, DELAYED]}
      />
      <PanelFrame
        title="Desktop 360pt · 3 cards"
        executions={[SUCCEEDED, DELAYED, PENDING]}
      />
      <PanelFrame
        title="Desktop 360pt · 5 cards + extreme amounts"
        executions={[SUCCEEDED, LARGE_AMOUNT, SUB_CENT_AMOUNT, DELAYED, FAILED]}
      />
      <PanelFrame
        title="Mobile 343pt · 2 cards"
        width={MOBILE_BODY_WIDTH}
        executions={[SUCCEEDED, FAILED]}
      />
      <DismissiblePanelFrame />
      <PanelFrame
        title="Short window 386pt · expanded + activation warning + 1 card (must scroll)"
        maxHeight={386}
        expanded
        activationWarning
        executions={[DELAYED]}
      />
      <PanelFrame
        title="Loading race · address ready but no selection yet"
        selectorLoading
        qrLoading
        executions={[]}
      />
      <PanelFrame
        title="Address fetch failed · terminal message, no shimmer, no dead press target"
        qrAddress={null}
        executions={[]}
      />
      <YStack gap="$2">
        <SizableText size="$bodySmMedium" color="$textSubdued">
          Terminal execution with no explorer links · &quot;See more
          details&quot; must not appear
        </SizableText>
        <Stack width={MOBILE_BODY_WIDTH}>
          <UnifoldExecutionDetail execution={noLinks} />
        </Stack>
      </YStack>
      <YStack gap="$2">
        <SizableText size="$bodySmMedium" color="$textSubdued">
          Divider guard · pending (7 rows) vs succeeded (6 rows) — every row
          must keep its divider
        </SizableText>
        <XStack gap="$4" flexWrap="wrap">
          <Stack width={MOBILE_BODY_WIDTH}>
            <UnifoldExecutionDetail execution={PENDING} />
          </Stack>
          <Stack width={MOBILE_BODY_WIDTH}>
            <UnifoldExecutionDetail execution={SUCCEEDED} />
          </Stack>
        </XStack>
      </YStack>
    </YStack>
  );
}

function StatusCardsGallery() {
  return (
    <YStack gap="$5">
      <StatusCardCase title="Single · succeeded" executions={[SUCCEEDED]} />
      <StatusCardCase title="Single · pending" executions={[PENDING]} />
      <StatusCardCase
        title="Single · delayed (must NOT look like a failure)"
        executions={[DELAYED]}
      />
      <StatusCardCase
        title="Single · waiting, all nullable fields null"
        executions={[WAITING_MINIMAL]}
      />
      <StatusCardCase
        title="Single · failed (contact support + session ref)"
        executions={[FAILED]}
      />
      <StatusCardCase title="Single · refunded" executions={[REFUNDED]} />
      <StatusCardCase
        title="Single · large amount (layout guard)"
        executions={[LARGE_AMOUNT]}
      />
      <StatusCardCase title="Single · zero amount" executions={[ZERO_AMOUNT]} />
      <StatusCardCase
        title="Single · sub-cent amount (must not read as 0)"
        executions={[SUB_CENT_AMOUNT]}
      />
      <StatusCardCase
        title="Single · negative amount (refund)"
        executions={[NEGATIVE_AMOUNT]}
      />
      <StatusCardCase
        title="Multiple · 3 concurrent deposits"
        executions={[SUCCEEDED, DELAYED, PENDING]}
      />
      <StatusCardCase
        title="Multiple · 5 deposits, mixed statuses + extreme amounts"
        executions={[SUCCEEDED, LARGE_AMOUNT, SUB_CENT_AMOUNT, DELAYED, FAILED]}
      />
      <StatusCardCase
        title="No sessionId (failed card falls back to plain support copy)"
        executions={[FAILED]}
        sessionId={null}
      />
    </YStack>
  );
}

function AmountMatrixRow({
  label,
  raw,
  out,
}: {
  label: string;
  raw: string;
  out: string;
}) {
  return (
    <XStack
      px="$3"
      py="$2"
      alignItems="center"
      gap="$2"
      bg="$bgSubdued"
      borderRadius="$2"
    >
      <SizableText size="$bodySm" color="$textSubdued" width={132}>
        {label}
      </SizableText>
      <SizableText
        size="$bodySm"
        color="$textDisabled"
        flex={1}
        minWidth={0}
        numberOfLines={1}
      >
        {raw}
      </SizableText>
      <SizableText size="$bodyMdMedium" color="$text" numberOfLines={1}>
        {out}
      </SizableText>
    </XStack>
  );
}

function AmountMatrixGallery() {
  return (
    <YStack gap="$5">
      <YStack gap="$2">
        <SizableText size="$bodyMdMedium">
          USD amounts (status cards, rows, USD Value)
        </SizableText>
        <YStack gap="$1.5">
          {AMOUNT_EDGE_CASES.map(([label, value]) => (
            <AmountMatrixRow
              key={label}
              label={label}
              raw={value === null ? 'null' : `"${value}"`}
              out={formatUnifoldUsd(value)}
            />
          ))}
        </YStack>
      </YStack>
      <YStack gap="$2">
        <SizableText size="$bodyMdMedium">
          Token amounts (Amount Sent / Received)
        </SizableText>
        <YStack gap="$1.5">
          {TOKEN_AMOUNT_EDGE_CASES.map(([label, args]) => (
            <AmountMatrixRow
              key={label}
              label={label}
              raw={`${args.baseUnit ?? 'null'} / ${args.decimals ?? 'null'}dp`}
              out={formatUnifoldTokenAmount(args)}
            />
          ))}
        </YStack>
      </YStack>
    </YStack>
  );
}

function TrackerRowsGallery() {
  const rows: Array<[string, IUnifoldDepositExecution]> = [
    ['succeeded', SUCCEEDED],
    ['pending', PENDING],
    ['delayed', DELAYED],
    ['waiting · all null', WAITING_MINIMAL],
    ['failed', FAILED],
    ['refunded', REFUNDED],
    ['large amount', LARGE_AMOUNT],
  ];
  return (
    <YStack gap="$3">
      {rows.map(([label, execution]) => (
        <YStack key={execution.executionId} gap="$1.5">
          <SizableText size="$bodySmMedium" color="$textSubdued">
            {label}
          </SizableText>
          <UnifoldExecutionRow execution={execution} onPress={() => {}} />
        </YStack>
      ))}
    </YStack>
  );
}

function ExecutionDetailGallery() {
  const cases: Array<[string, IUnifoldDepositExecution]> = [
    ['succeeded (both explorer links)', SUCCEEDED],
    ['pending (destination amounts render as —)', PENDING],
    ['delayed', DELAYED],
    ['waiting · all nullable fields null', WAITING_MINIMAL],
    ['failed (support banner)', FAILED],
    ['refunded', REFUNDED],
  ];
  return (
    <YStack gap="$6">
      {cases.map(([label, execution]) => (
        <YStack key={execution.executionId} gap="$2">
          <SizableText size="$bodySmMedium" color="$textSubdued">
            {label}
          </SizableText>
          <UnifoldExecutionDetail execution={execution} />
        </YStack>
      ))}
    </YStack>
  );
}

function TransferPiecesGallery() {
  return (
    <YStack gap="$6">
      <YStack gap="$2">
        <SizableText size="$bodySmMedium" color="$textSubdued">
          Source selector · loaded (Arbitrum $3 min)
        </SizableText>
        <UnifoldSourceSelector
          assets={SUPPORTED_ASSETS}
          selection={SELECTION}
          loading={false}
          onSelectToken={() => {}}
          onSelectChain={() => {}}
        />
      </YStack>
      <YStack gap="$2">
        <SizableText size="$bodySmMedium" color="$textSubdued">
          Source selector · loading
        </SizableText>
        <UnifoldSourceSelector
          assets={undefined}
          selection={null}
          loading
          onSelectToken={() => {}}
          onSelectChain={() => {}}
        />
      </YStack>
      <YStack gap="$2">
        <SizableText size="$bodySmMedium" color="$textSubdued">
          QR card · ready
        </SizableText>
        <UnifoldDepositQRCard
          address="0x1c30fdd3bb555dd594d92cbcf37dedaa327043b1"
          chainIconUri={ARB_ICON}
          loading={false}
        />
      </YStack>
      <YStack gap="$2">
        <SizableText size="$bodySmMedium" color="$textSubdued">
          QR card · loading skeleton
        </SizableText>
        <UnifoldDepositQRCard address={null} loading />
      </YStack>
      <YStack gap="$2">
        <SizableText size="$bodySmMedium" color="$textSubdued">
          QR card · no address (address fetch failed)
        </SizableText>
        <UnifoldDepositQRCard address={null} loading={false} />
      </YStack>
    </YStack>
  );
}

const UnifoldDepositGallery = () => (
  <Layout
    getFilePath={() => __CURRENT_FILE_PATH__}
    componentName="UnifoldDepositGallery"
    elements={[
      {
        title: 'Composite panel (overlay over real content, production widths)',
        element: <CompositePanelGallery />,
      },
      {
        title: 'Status cards (in-modal, D2 behaviour)',
        element: <StatusCardsGallery />,
      },
      {
        title: 'Amount formatting matrix (edge cases)',
        element: <AmountMatrixGallery />,
      },
      {
        title: 'Tracker rows',
        element: <TrackerRowsGallery />,
      },
      {
        title: 'Execution detail',
        element: <ExecutionDetailGallery />,
      },
      {
        title: 'Transfer screen pieces',
        element: <TransferPiecesGallery />,
      },
    ]}
  />
);

export default UnifoldDepositGallery;
