import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFileGraph = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M7 2h5v5a3 3 0 0 0 3 3h5v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3Zm2.5 14.5a1 1 0 1 0-2 0V18a1 1 0 1 0 2 0v-1.5Zm2.5-4a1 1 0 0 1 1 1V18a1 1 0 1 1-2 0v-4.5a1 1 0 0 1 1-1Zm4.5 3a1 1 0 1 0-2 0V18a1 1 0 1 0 2 0v-2.5Z"
      clipRule="evenodd"
    />
    <Path fill="currentColor" d="M14 2.586 19.414 8H15a1 1 0 0 1-1-1V2.586Z" />
  </Svg>
);
export default SvgFileGraph;
