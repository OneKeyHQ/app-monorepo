import Svg, { SvgProps, Rect, Path } from 'react-native-svg';
const SvgHuobiEcoChain = (props: SvgProps) => (
  <Svg viewBox="0 0 16 16" fill="none" accessibilityRole="image" {...props}>
    <Rect x={0.5} y={0.5} width={15} height={15} rx={7.5} fill="#303040" />
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M11.934 12.325c.036 0 .066-.03.066-.066V8.826a4.241 4.241 0 0 1-2.18 1.897v1.206c0 .218.178.396.397.396h1.717ZM9.82 6.778c0 .839-.68 1.519-1.519 1.519H7.84c-.584 0-1.057.473-1.057 1.056v1.057c0 .036.03.066.066.066h1.453A3.698 3.698 0 0 0 12 6.778V4.071a.396.396 0 0 0-.396-.396H9.82v3.103ZM4.142 3.675a.066.066 0 0 0-.066.066v3.433a4.241 4.241 0 0 1 2.18-1.897V4.07a.396.396 0 0 0-.397-.396H4.142ZM6.255 9.22c0-.838.68-1.518 1.519-1.518h.462c.584 0 1.057-.473 1.057-1.057V5.59a.066.066 0 0 0-.066-.066H7.774A3.698 3.698 0 0 0 4.076 9.22v2.708c0 .218.178.396.396.396h1.783V9.22Z"
      fill="#E2E2E8"
    />
    <Rect x={0.5} y={0.5} width={15} height={15} rx={7.5} stroke="#1E1E2A" />
  </Svg>
);
export default SvgHuobiEcoChain;
