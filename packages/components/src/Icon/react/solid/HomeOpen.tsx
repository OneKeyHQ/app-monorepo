import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgHomeOpen = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M13.976 2.4a3 3 0 0 0-3.952 0l-6 5.25A3 3 0 0 0 3 9.908V18a3 3 0 0 0 3 3h2a2 2 0 0 0 2-2v-3a2 2 0 1 1 4 0v3a2 2 0 0 0 2 2h2a3 3 0 0 0 3-3V9.908a3 3 0 0 0-1.024-2.258l-6-5.25Z"
    />
  </Svg>
);
export default SvgHomeOpen;
