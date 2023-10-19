import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgRocketLaunch = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M7 13H4.766a1 1 0 0 1-.857-1.514L5.417 8.97A2 2 0 0 1 7.132 8h4.118M7 13l4 4m-4-4 4.25-5M11 17v2.234a1 1 0 0 0 1.514.857l2.515-1.508A2 2 0 0 0 16 16.868V12.75M11 17l5-4.25m0 0c2.745-2.516 4.653-5.242 4.957-8.75a.88.88 0 0 0-.956-.957C16.49 3.347 13.766 5.255 11.25 8M5 21H3v-2a2 2 0 1 1 2 2Z"
    />
  </Svg>
);
export default SvgRocketLaunch;
