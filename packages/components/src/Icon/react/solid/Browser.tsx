import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBrowser = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M6 7a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm2 1a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm4-1a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 7a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7Zm18 0v3H4V7a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBrowser;
