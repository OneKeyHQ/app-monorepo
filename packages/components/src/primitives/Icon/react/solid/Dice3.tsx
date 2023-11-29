import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDice3 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6Zm6.5 2a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm4 4a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm2.5 5.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDice3;
