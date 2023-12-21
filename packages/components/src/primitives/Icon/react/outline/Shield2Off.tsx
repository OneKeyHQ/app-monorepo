import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgShield2Off = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M4 6v7a8 8 0 0 0 14.716 4.348M8 4.25l3.198-1.4a2 2 0 0 1 1.604 0l6 2.626A2 2 0 0 1 20 7.308V13c0 .168-.005.335-.015.5M2 4l20 16"
    />
  </Svg>
);
export default SvgShield2Off;
