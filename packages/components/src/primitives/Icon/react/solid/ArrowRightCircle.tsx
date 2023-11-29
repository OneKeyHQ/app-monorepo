import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowRightCircle = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12s4.477 10 10 10 10-4.477 10-10Zm-8.414 1-1.293 1.293a1 1 0 0 0 1.414 1.414L16 13.414a2 2 0 0 0 0-2.828l-2.293-2.293a1 1 0 1 0-1.414 1.414L13.586 11H8a1 1 0 1 0 0 2h5.586Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgArrowRightCircle;
