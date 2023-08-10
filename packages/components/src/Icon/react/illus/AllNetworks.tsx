import Svg, { SvgProps, Rect, Circle } from 'react-native-svg';
const SvgAllNetworks = (props: SvgProps) => (
  <Svg viewBox="0 0 16 16" fill="none" accessibilityRole="image" {...props}>
    <Rect x={0.5} y={0.5} width={15} height={15} rx={7.5} fill="#303040" />
    <Circle cx={6} cy={6} r={1.5} fill="#E2E2E8" />
    <Circle cx={6} cy={10} r={1.5} fill="#E2E2E8" />
    <Circle cx={10} cy={6} r={1.5} fill="#E2E2E8" />
    <Circle cx={10} cy={10} r={1.5} fill="#E2E2E8" />
    <Rect x={0.5} y={0.5} width={15} height={15} rx={7.5} stroke="#1E1E2A" />
  </Svg>
);
export default SvgAllNetworks;
