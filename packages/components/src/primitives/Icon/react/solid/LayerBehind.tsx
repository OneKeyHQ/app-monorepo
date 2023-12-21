import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLayerBehind = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M5 3a1 1 0 0 0 0 2h14a1 1 0 1 0 0-2H5Zm0 4a3 3 0 0 0-3 3v7a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-7a3 3 0 0 0-3-3H5Z"
    />
  </Svg>
);
export default SvgLayerBehind;
