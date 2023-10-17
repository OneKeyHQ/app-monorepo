import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronRight = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M8.293 3.293a1 1 0 0 1 1.414 0l6.586 6.586a3 3 0 0 1 0 4.242l-6.586 6.586a1 1 0 0 1-1.414-1.414l6.586-6.586a1 1 0 0 0 0-1.414L8.293 4.707a1 1 0 0 1 0-1.414Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChevronRight;
