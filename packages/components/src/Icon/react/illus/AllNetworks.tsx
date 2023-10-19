import Svg, { SvgProps, Circle } from 'react-native-svg';
const SvgAllNetworks = (props: SvgProps) => (
  <Svg viewBox="0 0 16 16" fill="none" accessibilityRole="image" {...props}>
    <Circle cx={6} cy={6} r={1.5} fill="#8C8CA1" />
    <Circle cx={6} cy={10} r={1.5} fill="#8C8CA1" />
    <Circle cx={10} cy={6} r={1.5} fill="#8C8CA1" />
    <Circle cx={10} cy={10} r={1.5} fill="#8C8CA1" />
  </Svg>
);
export default SvgAllNetworks;
