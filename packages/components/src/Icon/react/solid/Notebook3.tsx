import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgNotebook3 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3.5 5.5a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3V17a1 1 0 1 1 0-2v-2a1 1 0 1 1 0-2V9a1 1 0 0 1 0-2V5.5ZM9 8a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2h-4a1 1 0 0 1-1-1Zm0 4a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2h-2a1 1 0 0 1-1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgNotebook3;
