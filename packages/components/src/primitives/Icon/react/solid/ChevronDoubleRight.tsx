import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronDoubleRight = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6.293 7.293a1 1 0 0 1 1.414 0L11 10.586a2 2 0 0 1 0 2.828l-3.293 3.293a1 1 0 0 1-1.414-1.414L9.586 12 6.293 8.707a1 1 0 0 1 0-1.414Zm7 0a1 1 0 0 1 1.414 0L18 10.586a2 2 0 0 1 0 2.828l-3.293 3.293a1 1 0 0 1-1.414-1.414L16.586 12l-3.293-3.293a1 1 0 0 1 0-1.414Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChevronDoubleRight;
