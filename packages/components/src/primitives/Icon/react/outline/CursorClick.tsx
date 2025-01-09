import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCursorClick = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11 3v1.5m5.657.843-1.06 1.06m-9.193 9.193-1.06 1.06M4.5 11H3m3.404-4.596-1.06-1.06M14.136 20.8 10.4 11.047a.5.5 0 0 1 .646-.646l9.754 3.736a.5.5 0 0 1 .082.893l-3.53 2.157a.498.498 0 0 0-.166.166l-2.157 3.53a.5.5 0 0 1-.893-.082Z"
    />
  </Svg>
);
export default SvgCursorClick;
