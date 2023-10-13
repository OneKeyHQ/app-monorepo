import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgControllerRoundLeft = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M8.25 5.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM14.5 12a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0Zm-6.25 6.25a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M5.75 8.25a3.75 3.75 0 1 1 0 7.5 3.75 3.75 0 0 1 0-7.5ZM7.5 12A1.75 1.75 0 1 0 4 12a1.75 1.75 0 0 0 3.5 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgControllerRoundLeft;
