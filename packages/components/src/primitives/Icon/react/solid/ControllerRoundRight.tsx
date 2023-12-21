import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgControllerRoundRight = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M12 2a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 2ZM5.75 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5Zm2.5 10a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M18.25 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5ZM16.5 12a1.75 1.75 0 1 1 3.5 0 1.75 1.75 0 0 1-3.5 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgControllerRoundRight;
