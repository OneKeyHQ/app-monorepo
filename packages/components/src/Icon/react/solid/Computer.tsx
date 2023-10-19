import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgComputer = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path fill="currentColor" d="M5 3a3 3 0 0 0-3 3v6h20V6a3 3 0 0 0-3-3H5Z" />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 15v-1h20v1a3 3 0 0 1-3 3h-4v3a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-3H5a3 3 0 0 1-3-3Zm9 3v2h2v-2h-2Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgComputer;
