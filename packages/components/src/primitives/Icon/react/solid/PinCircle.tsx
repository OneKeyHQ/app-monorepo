import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPinCircle = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M11.998 11a1.5 1.5 0 1 0 .005-3 1.5 1.5 0 0 0-.005 3Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2Zm1 10.854a3.5 3.5 0 1 0-2 0V17a1 1 0 1 0 2 0v-4.146Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPinCircle;
