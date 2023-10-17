import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCup2 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M8 3a1 1 0 0 0-2 0v2a1 1 0 0 0 2 0V3Zm4 0a1 1 0 1 0-2 0v2a1 1 0 1 0 2 0V3Zm4 0a1 1 0 1 0-2 0v2a1 1 0 1 0 2 0V3Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M4 9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2h.5a3.5 3.5 0 1 1 0 7H18v3a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V9Zm14 5h.5a1.5 1.5 0 0 0 0-3H18v3Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCup2;
