import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSunset = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M2 16h20M7 20h10M4 12a8 8 0 1 1 16 0"
    />
  </Svg>
);
export default SvgSunset;
