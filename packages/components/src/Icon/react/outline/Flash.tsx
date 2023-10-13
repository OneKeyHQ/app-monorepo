import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFlash = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19.566 9H13.5a.5.5 0 0 1-.5-.5V2.401a.5.5 0 0 0-.916-.277L4.018 14.223a.5.5 0 0 0 .416.777H10.5a.5.5 0 0 1 .5.5v6.099a.5.5 0 0 0 .916.277l8.066-12.099A.5.5 0 0 0 19.566 9Z"
    />
  </Svg>
);
export default SvgFlash;
