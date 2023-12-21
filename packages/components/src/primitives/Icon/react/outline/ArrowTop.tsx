import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowTop = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="m13 5.664 4.293 4.293a1 1 0 0 0 1.414-1.414l-4.586-4.586a3 3 0 0 0-4.242 0L5.293 8.543a1 1 0 0 0 1.414 1.414L11 5.664V20a1 1 0 1 0 2 0V5.664Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgArrowTop;
