import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCc = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6Zm11.543 5.293a1 1 0 0 1 1.414 0 1 1 0 0 0 1.414-1.414 3 3 0 1 0 0 4.242 1 1 0 0 0-1.414-1.414 1 1 0 0 1-1.414-1.414Zm-6 0a1 1 0 0 1 1.414 0 1 1 0 0 0 1.414-1.414 3 3 0 1 0 0 4.243 1 1 0 0 0-1.414-1.415 1 1 0 0 1-1.414-1.414Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCc;
