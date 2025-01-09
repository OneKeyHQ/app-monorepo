import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCc = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6Zm3-1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H6Zm9.957 6.293a1 1 0 1 0 0 1.414 1 1 0 0 1 1.414 1.414 3 3 0 1 1 0-4.242 1 1 0 0 1-1.414 1.414Zm-6.331-.22a1 1 0 1 0 .331 1.634 1 1 0 0 1 1.414 1.414 3 3 0 1 1 0-4.242 1 1 0 0 1-1.414 1.414.994.994 0 0 0-.331-.22Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCc;
