import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDock = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M14 7h5a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-5m2-5L4 4m6 0v5.25a.75.75 0 0 1-.75.75H4"
    />
  </Svg>
);
export default SvgDock;
