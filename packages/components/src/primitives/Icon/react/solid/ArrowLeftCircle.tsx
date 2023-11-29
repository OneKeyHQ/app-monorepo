import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowLeftCircle = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 12c0 5.523 4.477 10 10 10s10-4.477 10-10S17.523 2 12 2 2 6.477 2 12Zm8.414-1 1.293-1.293a1 1 0 0 0-1.414-1.414L8 10.586a2 2 0 0 0 0 2.828l2.293 2.293a1 1 0 0 0 1.414-1.414L10.414 13H16a1 1 0 1 0 0-2h-5.586Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgArrowLeftCircle;
