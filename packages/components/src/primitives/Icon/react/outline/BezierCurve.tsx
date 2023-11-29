import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBezierCurve = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M4.5 7a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm18 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
    />
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4.5 7a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm18 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
    />
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 7h7m4 0h7M4 15c0-3.728 2.55-6.86 6-7.748m4 0c3.45.888 6 4.02 6 7.748m-9-6h2a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1Zm8 10h2a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1ZM3 19h2a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1Z"
    />
  </Svg>
);
export default SvgBezierCurve;
