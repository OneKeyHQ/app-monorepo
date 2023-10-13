import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgGarage = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M10.488 3.474a3 3 0 0 1 3.024 0l7 4.083A3 3 0 0 1 22 10.15V17a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-6.851a3 3 0 0 1 1.488-2.592l7-4.083ZM8 18h8v-2H8v2Zm0-4h8v-1a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgGarage;
