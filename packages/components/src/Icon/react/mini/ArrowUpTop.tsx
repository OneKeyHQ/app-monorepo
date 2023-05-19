import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowUpTop = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9.25 17.25a.75.75 0 0 0 1.5 0V8.636l2.955 3.129a.75.75 0 0 0 1.09-1.03l-4.25-4.5a.75.75 0 0 0-1.09 0l-4.25 4.5a.75.75 0 0 0 1.09 1.03L9.25 8.636v8.614ZM2 2.75A.75.75 0 0 1 2.75 2h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 2.75Z" />
  </Svg>
);
export default SvgArrowUpTop;
