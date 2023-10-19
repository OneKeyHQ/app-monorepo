import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgTape = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M7 12a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm10 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M1 7a3 3 0 0 1 3-3h16a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3V7Zm10 5c0 .35-.06.687-.17 1h2.34A3 3 0 1 1 16 15H8a3 3 0 1 1 3-3Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTape;
