import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronRightSmall = (props: SvgProps) => (
  <Svg viewBox="0 0 24 24" fill="none" accessibilityRole="image" {...props}>
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M9.293 7.293a1 1 0 0 1 1.414 0L14 10.586a2 2 0 0 1 0 2.828l-3.293 3.293a1 1 0 0 1-1.414-1.414L12.586 12 9.293 8.707a1 1 0 0 1 0-1.414Z"
      fill="currentColor"
    />
  </Svg>
);
export default SvgChevronRightSmall;
