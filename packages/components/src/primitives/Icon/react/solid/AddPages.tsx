import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAddPages = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M4 5a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v1h1a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3v-1H7a3 3 0 0 1-3-3V5Zm10 1h-3a3 3 0 0 0-3 3v7H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v1Zm1 6a1 1 0 1 0-2 0v1h-1a1 1 0 1 0 0 2h1v1a1 1 0 1 0 2 0v-1h1a1 1 0 1 0 0-2h-1v-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAddPages;
