import Svg, { SvgProps, Rect, Path } from 'react-native-svg';
const SvgEthereumClassic = (props: SvgProps) => (
  <Svg viewBox="0 0 16 16" fill="none" accessibilityRole="image" {...props}>
    <Rect x={0.5} y={0.5} width={15} height={15} rx={7.5} fill="#303040" />
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12.04 7.269 8.076 1 4 7.269l4.077-1.69 3.962 1.69ZM4.16 8.996l3.963 6.137L12.2 8.996l-4.077 2.44-3.962-2.44Z"
      fill="#E2E2E8"
    />
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12.2 8.19 8.077 6.471 4 8.189l4.077 2.442L12.2 8.189Z"
      fill="#E2E2E8"
    />
    <Rect x={0.5} y={0.5} width={15} height={15} rx={7.5} stroke="#1E1E2A" />
  </Svg>
);
export default SvgEthereumClassic;
