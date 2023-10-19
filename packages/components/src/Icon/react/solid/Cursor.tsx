import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCursor = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M5.305 2.719c-1.605-.563-3.148.98-2.585 2.585l5.39 15.362c.613 1.745 3.05 1.827 3.778.128l2.673-6.234 6.234-2.673c1.7-.729 1.617-3.165-.128-3.777L5.305 2.719Z"
    />
  </Svg>
);
export default SvgCursor;
