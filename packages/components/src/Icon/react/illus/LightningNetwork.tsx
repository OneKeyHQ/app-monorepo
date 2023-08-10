import Svg, { SvgProps, Rect, Path } from 'react-native-svg';
const SvgLightningNetwork = (props: SvgProps) => (
  <Svg viewBox="0 0 16 16" fill="none" accessibilityRole="image" {...props}>
    <Rect x={0.5} y={0.5} width={15} height={15} rx={7.5} fill="#303040" />
    <Path
      d="M9.24 2.667c-.477 1.238-.954 2.57-1.526 3.904 0 0 0 .19.19.19h3.912s0 .096.095.191l-5.723 6.381c-.096-.095-.096-.19-.096-.286l2.003-4.285V8.38H4.09V8l4.865-5.333h.286Z"
      fill="#E2E2E8"
    />
    <Rect x={0.5} y={0.5} width={15} height={15} rx={7.5} stroke="#1E1E2A" />
  </Svg>
);
export default SvgLightningNetwork;
