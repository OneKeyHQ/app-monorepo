import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgTicket = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 7a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v2.17a1 1 0 0 1-.667.944 2.001 2.001 0 0 0 0 3.772 1 1 0 0 1 .667.943V17a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-2.17a1 1 0 0 1 .667-.944 2.001 2.001 0 0 0 0-3.772A1 1 0 0 1 2 9.17V7Zm3-1a1 1 0 0 0-1 1v1.535c1.195.692 2 1.983 2 3.465a3.998 3.998 0 0 1-2 3.465V17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1.535A3.998 3.998 0 0 1 18 12c0-1.482.805-2.773 2-3.465V7a1 1 0 0 0-1-1H5Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="M14 8a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm0 4a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm0 4a1 1 0 1 1 2 0 1 1 0 0 1-2 0Z"
    />
  </Svg>
);
export default SvgTicket;
