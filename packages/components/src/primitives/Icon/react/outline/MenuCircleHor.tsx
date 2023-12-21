import Svg, { SvgProps, Circle, Path } from 'react-native-svg';
const SvgMenuCircleHor = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Circle cx={12} cy={12} r={9} stroke="currentColor" strokeWidth={2} />
    <Path
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={0.75}
      d="M8 12.875a.875.875 0 1 0 0-1.75.875.875 0 0 0 0 1.75Zm4 0a.875.875 0 1 0 0-1.75.875.875 0 0 0 0 1.75Zm4 0a.875.875 0 1 0 0-1.75.875.875 0 0 0 0 1.75Z"
    />
  </Svg>
);
export default SvgMenuCircleHor;
