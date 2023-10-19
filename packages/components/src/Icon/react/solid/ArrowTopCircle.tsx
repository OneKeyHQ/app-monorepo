import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowTopCircle = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2Zm1 8.414 1.293 1.293a1 1 0 0 0 1.414-1.414L13.414 8a2 2 0 0 0-2.828 0l-2.293 2.293a1 1 0 1 0 1.414 1.414L11 10.414V16a1 1 0 1 0 2 0v-5.586Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgArrowTopCircle;
