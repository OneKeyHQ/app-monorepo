import Svg, { SvgProps, Circle } from 'react-native-svg';
const SvgCirclePlaceholderOn = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Circle cx={12} cy={12} r={9} stroke="currentColor" strokeWidth={2} />
  </Svg>
);
export default SvgCirclePlaceholderOn;
