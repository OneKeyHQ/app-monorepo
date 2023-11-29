import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgNotebook1 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M6 2.541A3 3 0 0 0 3.5 5.5v13A3 3 0 0 0 6 21.459V2.54Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M8 21.5h9.5a3 3 0 0 0 3-3v-13a3 3 0 0 0-3-3H8v19ZM13 7a1 1 0 1 0 0 2h2.5a1 1 0 1 0 0-2H13Zm0 4a1 1 0 1 0 0 2h2.5a1 1 0 1 0 0-2H13Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgNotebook1;
