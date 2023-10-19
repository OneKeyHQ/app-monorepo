import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPages = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M7 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h1v1a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V9a3 3 0 0 0-3-3h-1V5a3 3 0 0 0-3-3H7Zm4 4h3V5a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h1V9a3 3 0 0 1 3-3Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPages;
