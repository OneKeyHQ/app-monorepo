import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDice6 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6 21a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6ZM9.5 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM8 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm0 4a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm8-4a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm1.5 2.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM16 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDice6;
