import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBuildings = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 6a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v1h3a3 3 0 0 1 3 3v8h1a1 1 0 1 1 0 2H2a1 1 0 1 1 0-2h1V6Zm12 12h4v-8a1 1 0 0 0-1-1h-3v9ZM7 9a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1Zm0 4a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBuildings;
