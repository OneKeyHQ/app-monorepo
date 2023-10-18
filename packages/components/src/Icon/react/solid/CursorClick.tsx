import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCursorClick = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M11 2a1 1 0 0 1 1 1v1.5a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1Zm6.363 2.636a1 1 0 0 1 0 1.414l-1.06 1.06a1 1 0 1 1-1.415-1.414l1.061-1.06a1 1 0 0 1 1.414 0ZM7.111 16.303a1 1 0 0 0-1.414-1.414l-1.06 1.06a1 1 0 1 0 1.414 1.415l1.06-1.061ZM5.5 11a1 1 0 0 1-1 1H3a1 1 0 1 1 0-2h1.5a1 1 0 0 1 1 1Zm.197-3.889a1 1 0 1 0 1.414-1.414l-1.06-1.06A1 1 0 0 0 4.636 6.05l1.061 1.06Zm5.706 2.356c-1.212-.464-2.401.725-1.937 1.937l3.736 9.755c.445 1.162 2.031 1.308 2.68.245l2.095-3.427 3.426-2.094c1.063-.649.917-2.235-.245-2.68l-9.755-3.736Z"
    />
  </Svg>
);
export default SvgCursorClick;
