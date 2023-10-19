import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBezierEdit = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16 6v1a1 1 0 0 0 1 1h1m-2-2V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-1m-2-2H8M6 8v8m2 2h2m8-10v2M5 20h2a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1ZM5 8h2a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1Zm9 9.667V20h2.333l3.5-3.5a1.65 1.65 0 1 0-2.333-2.333l-3.5 3.5Z"
    />
  </Svg>
);
export default SvgBezierEdit;
