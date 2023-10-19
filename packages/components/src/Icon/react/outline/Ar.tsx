import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAr = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeWidth={2}
      d="M2 8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-3.248a2 2 0 0 1-1.317-.495l-2.777-2.429a1 1 0 0 0-1.316 0l-2.776 2.43A2 2 0 0 1 7.249 19H4a2 2 0 0 1-2-2V8Z"
    />
    <Path
      stroke="currentColor"
      strokeWidth={2}
      d="M9.25 11.5a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0Zm9 0a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0Z"
    />
  </Svg>
);
export default SvgAr;
