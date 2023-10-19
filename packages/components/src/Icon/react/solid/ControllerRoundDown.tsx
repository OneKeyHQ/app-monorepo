import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgControllerRoundDown = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M8.25 5.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM14.5 12a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM2 12a3.75 3.75 0 1 1 7.5 0A3.75 3.75 0 0 1 2 12Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 14.5a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5Zm-1.75 3.75a1.75 1.75 0 1 1 3.5 0 1.75 1.75 0 0 1-3.5 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgControllerRoundDown;
