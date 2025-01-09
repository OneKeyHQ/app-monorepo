import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAvocado = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M17.089 2.002c1.361-.03 2.71.277 3.672 1.24.96.963 1.267 2.314 1.237 3.677-.031 1.371-.402 2.894-.962 4.393-1.116 2.994-3.068 6.124-5.022 8.14-3.08 3.179-8.453 3.512-11.692.267-3.295-3.2-2.965-8.581.241-11.708 2.018-1.967 5.146-3.926 8.138-5.046 1.498-.56 3.018-.932 4.388-.963ZM9.75 17.75a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAvocado;
