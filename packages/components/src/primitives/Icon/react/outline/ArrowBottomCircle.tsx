import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowBottomCircle = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8v7.25M15 13l-2.293 2.293a1 1 0 0 1-1.414 0L9 13m3 8a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z"
    />
  </Svg>
);
export default SvgArrowBottomCircle;
