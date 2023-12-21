import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCube = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M10.53 2.68a3 3 0 0 1 2.94 0l6 3.375c.17.095.329.206.474.33L12 10.853 4.056 6.384a3 3 0 0 1 .473-.33l6-3.374ZM3.051 8.114A3 3 0 0 0 3 8.67v6.66a3 3 0 0 0 1.53 2.615l6 3.375c.151.086.31.157.47.214v-8.949L3.053 8.114ZM13 21.534c.16-.057.318-.129.47-.214l6-3.375A3 3 0 0 0 21 15.33V8.67c0-.189-.018-.374-.052-.556l-7.947 4.471v8.949Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCube;
