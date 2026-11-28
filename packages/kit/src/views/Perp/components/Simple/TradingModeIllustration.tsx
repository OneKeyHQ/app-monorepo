import { useIntl } from 'react-intl';
import Svg, { Circle, G, Path, Rect, Text } from 'react-native-svg';

import { ETranslations } from '@onekeyhq/shared/src/locale';

// Fixed artwork colors keep these illustrative controls separate from live orders.
const colors = {
  ink: '#101114',
  muted: '#858894',
  control: '#E5E6EB',
  controlSubdued: '#F1F2F4',
  green: '#22AB15',
  red: '#E5484D',
  chart: '#2DBF68',
  bid: '#EDF1EE',
  ask: '#FCE8E8',
};

function Label({
  x,
  y,
  children,
  size = 38,
  fill = colors.ink,
  weight = '600',
  anchor = 'start',
}: {
  x: number;
  y: number;
  children: string;
  size?: number;
  fill?: string;
  weight?: '400' | '500' | '600' | '700';
  anchor?: 'start' | 'middle' | 'end';
}) {
  return (
    <Text
      x={x}
      y={y}
      fontFamily="Arial"
      fontSize={size}
      fontWeight={weight}
      textAnchor={anchor}
      fill={fill}
    >
      {children}
    </Text>
  );
}

function Chevron({ x, y }: { x: number; y: number }) {
  return (
    <Path
      d={`M${x - 10} ${y - 5}l10 10 10-10`}
      fill="none"
      stroke={colors.ink}
      strokeWidth={5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

function Header({ simple }: { simple: boolean }) {
  return (
    <G>
      <Circle cx={110} cy={110} r={50} fill="#F7931A" />
      {/* Reuse the Bitcoin mark from components/svg/illus/btc-circle.svg. */}
      <G transform="translate(60 60) scale(3.125)">
        <Path
          d="M23.189 14.02C23.503 11.924 21.906 10.797 19.724 10.045L20.432 7.205L18.704 6.775L18.014 9.54C17.56 9.426 17.094 9.32 16.629 9.214L17.324 6.431L15.596 6L14.888 8.839C14.512 8.753 14.142 8.669 13.784 8.579L13.786 8.57L11.402 7.975L10.942 9.821C10.942 9.821 12.225 10.115 12.198 10.133C12.898 10.308 13.024 10.771 13.003 11.139L12.197 14.374C12.245 14.386 12.307 14.404 12.377 14.431L12.194 14.386L11.064 18.918C10.978 19.13 10.761 19.449 10.271 19.328C10.289 19.353 9.01498 19.015 9.01498 19.015L8.15698 20.993L10.407 21.554C10.825 21.659 11.235 21.769 11.638 21.872L10.923 24.744L12.65 25.174L13.358 22.334C13.83 22.461 14.288 22.579 14.736 22.691L14.03 25.519L15.758 25.949L16.473 23.083C19.421 23.641 21.637 23.416 22.57 20.75C23.322 18.604 22.533 17.365 20.982 16.558C22.112 16.298 22.962 15.555 23.189 14.02ZM19.239 19.558C18.706 21.705 15.091 20.544 13.919 20.253L14.869 16.448C16.041 16.741 19.798 17.32 19.239 19.558ZM19.774 13.989C19.287 15.942 16.279 14.949 15.304 14.706L16.164 11.256C17.139 11.499 20.282 11.952 19.774 13.989Z"
          fill="#FFFFFF"
        />
      </G>
      <Label x={187} y={132} size={64} weight="700">
        BTC
      </Label>
      <Chevron x={342} y={112} />
      {simple ? (
        <Label x={940} y={132} size={66} weight="700" anchor="end">
          64,265
        </Label>
      ) : (
        <G transform="translate(896 82) scale(2.3)">
          <Path
            d="M8 9h3v10H8v3H6v-3H3V9h3V2h2v7Zm-3 8h4v-6H5v6ZM18 5h3v14h-3v3h-2v-3h-3V5h3V2h2v3Zm-3 12h4V7h-4v10Z"
            fill="#999DA3"
            fillRule="evenodd"
          />
        </G>
      )}
    </G>
  );
}

function Action({
  x,
  y,
  width,
  height = 90,
  side,
}: {
  x: number;
  y: number;
  width: number;
  height?: number;
  side: 'Long' | 'Short';
}) {
  const intl = useIntl();
  return (
    <G>
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={height / 2}
        fill={side === 'Long' ? colors.green : colors.red}
      />
      <Label
        x={x + width / 2}
        y={y + height / 2 + 16}
        size={50}
        fill="#FFFFFF"
        anchor="middle"
      >
        {intl.formatMessage({
          id:
            side === 'Long'
              ? ETranslations.perp_long
              : ETranslations.perp_short,
        })}
      </Label>
    </G>
  );
}

const chartPath =
  'M50 505C65 482 74 501 92 483S122 446 140 441S168 474 186 461S215 381 236 374S258 388 276 358S297 294 316 310S337 350 356 334S382 381 400 390S422 362 440 388S473 463 493 467S514 441 534 454S561 436 579 403S598 369 615 383S642 331 661 331S681 292 700 310S726 358 746 346S772 334 790 354S819 395 837 390S860 423 879 414S905 452 922 427S945 402 950 403';

function EasyContent() {
  return (
    <G>
      <Path d={`${chartPath}V635H50Z`} fill="#EDF8EF" />
      <Path
        d={chartPath}
        fill="none"
        stroke={colors.chart}
        strokeWidth={8}
        strokeLinecap="round"
      />
      <Circle cx={950} cy={403} r={13} fill={colors.chart} />
      <Rect
        x={60}
        y={700}
        width={880}
        height={58}
        rx={29}
        fill={colors.control}
      />
      <Rect
        x={60}
        y={700}
        width={220}
        height={58}
        rx={29}
        fill={colors.chart}
      />
      {[85, 500, 707, 915].map((x, index) => (
        <Circle
          key={x}
          cx={x}
          cy={729}
          r={7}
          fill={index === 0 ? '#FFFFFF' : '#B1B5C0'}
        />
      ))}
      <Circle
        cx={280}
        cy={729}
        r={31}
        fill="#FFFFFF"
        stroke={colors.chart}
        strokeWidth={4}
      />
      <Action x={50} y={810} width={435} height={120} side="Long" />
      <Action x={515} y={810} width={435} height={120} side="Short" />
    </G>
  );
}

function ProContent() {
  const intl = useIntl();
  return (
    <G>
      <Label x={50} y={262} size={38} fill={colors.muted}>
        {intl.formatMessage({ id: ETranslations.perps_order_book })}
      </Label>
      {[
        { price: '64,284', y: 330, width: 325, ask: true },
        { price: '64,278', y: 405, width: 285, ask: true },
        { price: '64,267', y: 480, width: 245, ask: true },
        { price: '64,264', y: 680, width: 245, ask: false },
        { price: '64,253', y: 775, width: 285, ask: false },
        { price: '64,241', y: 870, width: 325, ask: false },
      ].map(({ price, y, width, ask }) => (
        <G key={price}>
          <Rect
            x={50}
            y={y}
            width={width}
            height={60}
            rx={18}
            fill={ask ? colors.ask : colors.bid}
          />
          <Label
            x={66}
            y={y + 42}
            size={36}
            fill={ask ? colors.red : '#23822B'}
          >
            {price}
          </Label>
        </G>
      ))}
      <Label x={60} y={620} size={62} weight="700">
        64,265
      </Label>
      <Rect
        x={415}
        y={216}
        width={535}
        height={72}
        rx={36}
        fill={colors.controlSubdued}
      />
      <Rect x={684} y={220} width={262} height={64} rx={32} fill="#FFFFFF" />
      <Label x={548} y={264} anchor="middle" weight="400">
        {intl.formatMessage({ id: ETranslations.perp_position_market })}
      </Label>
      <Label x={816} y={264} anchor="middle">
        {intl.formatMessage({ id: ETranslations.perp_position_limit })}
      </Label>
      {[
        {
          x: 415,
          label: intl.formatMessage({ id: ETranslations.perp_trade_cross }),
        },
        { x: 695, label: '5×' },
      ].map(({ x, label }) => (
        <G key={label}>
          <Rect
            x={x}
            y={330}
            width={255}
            height={64}
            rx={32}
            fill={colors.controlSubdued}
          />
          <Label x={x + 30} y={374} weight="400">
            {label}
          </Label>
          <Chevron x={x + 219} y={362} />
        </G>
      ))}
      {[
        {
          label: intl.formatMessage({ id: ETranslations.perp_orderbook_price }),
          value: '64,265',
          y: 424,
        },
        {
          label: intl.formatMessage({ id: ETranslations.perp_orderbook_size }),
          value: '100 USD',
          y: 518,
        },
      ].map(({ label, value, y }) => (
        <G key={label}>
          <Rect
            x={415}
            y={y}
            width={535}
            height={74}
            rx={26}
            fill={colors.controlSubdued}
          />
          <Label x={443} y={y + 50} fill={colors.muted} weight="400">
            {label}
          </Label>
          <Label x={922} y={y + 50} anchor="end">
            {value}
          </Label>
        </G>
      ))}
      <Rect
        x={426}
        y={634}
        width={510}
        height={10}
        rx={5}
        fill={colors.control}
      />
      <Rect
        x={426}
        y={634}
        width={128}
        height={10}
        rx={5}
        fill={colors.chart}
      />
      {[681, 809, 936].map((x) => (
        <Circle key={x} cx={x} cy={639} r={6} fill="#B1B5C0" />
      ))}
      <Circle
        cx={554}
        cy={639}
        r={18}
        fill="#FFFFFF"
        stroke={colors.chart}
        strokeWidth={3}
      />
      <Label x={554} y={693} size={30} fill={colors.muted} anchor="middle">
        25%
      </Label>
      <Action x={415} y={730} width={535} side="Long" />
      <Action x={415} y={840} width={535} side="Short" />
    </G>
  );
}

export function TradingModeIllustration({ mode }: { mode: 'simple' | 'pro' }) {
  const simple = mode === 'simple';
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 1000 1000"
      accessible={false}
      pointerEvents="none"
    >
      <Rect
        x={1.5}
        y={1.5}
        width={997}
        height={997}
        rx={62.5}
        fill="#FFFFFF"
        stroke="#E5E7EB"
        strokeWidth={3}
      />
      <Header simple={simple} />
      {simple ? <EasyContent /> : <ProContent />}
    </Svg>
  );
}
