import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFileGraph = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M13 3.5V7a2 2 0 0 0 2 2h3.5m-10 8.5V16m3.5 1.5V13m3.5 4.5V15M7 3h5.172a2 2 0 0 1 1.414.586l4.828 4.828A2 2 0 0 1 19 9.828V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
    />
  </Svg>
);
export default SvgFileGraph;
