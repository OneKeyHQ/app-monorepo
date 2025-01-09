import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgServer = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 7a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v4H2V7Zm4.5.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM2 13h20v4a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-4Zm4.5 3.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgServer;
