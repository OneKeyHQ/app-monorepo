import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgUndock = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M14 7h5a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-5M5 5l5.25 5.25M4 10V4.75A.75.75 0 0 1 4.75 4H10"
    />
  </Svg>
);
export default SvgUndock;
