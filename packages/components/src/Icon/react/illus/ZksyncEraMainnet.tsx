import Svg, { SvgProps, Rect, Path } from 'react-native-svg';
const SvgZksyncEraMainnet = (props: SvgProps) => (
  <Svg viewBox="0 0 16 16" fill="none" accessibilityRole="image" {...props}>
    <Rect x={0.5} y={0.5} width={15} height={15} rx={7.5} fill="#303040" />
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4.85 6.25v-2.1L1 7.825l3.85 4.025v-2.8l4.2-2.8h-4.2Z"
      fill="#E2E2E8"
    />
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="m15 8-3.85-3.85v2.8l-4.2 2.8h4.2v2.1L15 8Z"
      fill="#8C8CA1"
    />
    <Rect x={0.5} y={0.5} width={15} height={15} rx={7.5} stroke="#1E1E2A" />
  </Svg>
);
export default SvgZksyncEraMainnet;
