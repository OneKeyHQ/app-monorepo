import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgConsole = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6Zm3.793 1.293a1 1 0 0 1 1.414 0l1.147 1.146a1.5 1.5 0 0 1 0 2.122l-1.147 1.146a1 1 0 0 1-1.414-1.414l.793-.793-.793-.793a1 1 0 0 1 0-1.414ZM11.5 10a1 1 0 1 0 0 2H13a1 1 0 1 0 0-2h-1.5Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgConsole;
