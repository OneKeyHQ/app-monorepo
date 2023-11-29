import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgTicket = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 7a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v2.17a1 1 0 0 1-.667.944 2.001 2.001 0 0 0 0 3.772 1 1 0 0 1 .667.943V17a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-2.17a1 1 0 0 1 .667-.944 2.001 2.001 0 0 0 0-3.772A1 1 0 0 1 2 9.17V7Zm12 1a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm0 4a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm1 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTicket;
