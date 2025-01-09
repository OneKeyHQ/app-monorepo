import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCompass = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeWidth={2}
      d="M15.931 17.305a2 2 0 0 0 1.374-1.373l3.2-11.201a1 1 0 0 0-1.236-1.237l-11.2 3.2a2 2 0 0 0-1.374 1.374l-3.2 11.201a1 1 0 0 0 1.236 1.237l11.2-3.2Z"
    />
    <Path
      stroke="currentColor"
      strokeWidth={2}
      d="M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"
    />
  </Svg>
);
export default SvgCompass;
