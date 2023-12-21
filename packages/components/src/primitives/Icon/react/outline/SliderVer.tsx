import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSliderVer = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 14V4m0 10a3 3 0 1 1 0 6 3 3 0 1 1 0-6ZM7 20v-8m0 0a3 3 0 1 1 0-6m0 6a3 3 0 1 0 0-6m0 0V4"
    />
  </Svg>
);
export default SvgSliderVer;
