import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBezierMouse = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16 6v1a1 1 0 0 0 1 1h1m-2-2V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-1m-2-2H8M6 8v8m2 2h2m8-10v2M5 20h2a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1ZM5 8h2a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1Zm8.115 4.497 6.452 1.844a.5.5 0 0 1 .1.92l-2.731 1.472a.5.5 0 0 0-.203.203l-1.471 2.731a.5.5 0 0 1-.921-.1l-1.844-6.452a.5.5 0 0 1 .618-.618Z"
    />
  </Svg>
);
export default SvgBezierMouse;
