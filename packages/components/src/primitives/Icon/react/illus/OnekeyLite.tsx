import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgOnekeyLite = (props: SvgProps) => (
  <Svg viewBox="0 0 20 16" fill="none" accessibilityRole="image" {...props}>
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M0 3a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H3a3 3 0 0 1-3-3V3Zm3-1a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H3Zm1 9a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Z"
      fill="currentColor"
    />
    <Path
      d="M4 7.5a1 1 0 0 1 1-1h1a1 1 0 0 1 0 2H5a1 1 0 0 1-1-1Z"
      fill="currentColor"
    />
  </Svg>
);
export default SvgOnekeyLite;
