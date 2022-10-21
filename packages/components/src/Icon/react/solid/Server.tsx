import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgServer = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M2 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5zm14 1a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM2 13a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2zm14 1a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgServer;
