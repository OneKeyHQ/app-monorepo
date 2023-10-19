import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowBottomCircle = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Zm-1-8.414-1.293-1.293a1 1 0 0 0-1.414 1.414L10.586 16a2 2 0 0 0 2.828 0l2.293-2.293a1 1 0 0 0-1.414-1.414L13 13.586V8a1 1 0 1 0-2 0v5.586Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgArrowBottomCircle;
