import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgHomeOpen = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M20 18V9.908a2 2 0 0 0-.683-1.506l-6-5.25a2 2 0 0 0-2.634 0l-6 5.25A2 2 0 0 0 4 9.908V18a2 2 0 0 0 2 2h3a1 1 0 0 0 1-1v-3a2 2 0 1 1 4 0v3a1 1 0 0 0 1 1h3a2 2 0 0 0 2-2Z"
    />
  </Svg>
);
export default SvgHomeOpen;
