import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgClipboard = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M8.17 4A3.001 3.001 0 0 1 11 2h2c1.306 0 2.418.835 2.83 2H17a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h1.17ZM10 5v1h4V5a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgClipboard;
