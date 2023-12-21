import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLaptop = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v9h1a1 1 0 0 1 1 1v2a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3v-2a1 1 0 0 1 1-1h1V6Zm0 11v1a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-1H3Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLaptop;
