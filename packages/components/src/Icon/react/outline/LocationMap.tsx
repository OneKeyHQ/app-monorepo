import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLocationMap = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 7H7M3 17.5v-11A2.5 2.5 0 0 1 5.5 4H7v11H5.5A2.5 2.5 0 0 0 3 17.5Zm0 0A2.5 2.5 0 0 0 5.5 20H18a2 2 0 0 0 2-2v-4m0-7c0 2.5-3 4-3 4s-3-1.5-3-4a3 3 0 1 1 6 0Z"
    />
  </Svg>
);
export default SvgLocationMap;
