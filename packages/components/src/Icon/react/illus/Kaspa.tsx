import Svg, { SvgProps, Rect, Path } from 'react-native-svg';
const SvgKaspa = (props: SvgProps) => (
  <Svg viewBox="0 0 16 16" fill="none" accessibilityRole="image" {...props}>
    <Rect x={0.5} y={0.5} width={15} height={15} rx={7.5} fill="#303040" />
    <Path
      d="m10.08 3.358-1.697.254.495 3.29L5.323 4.16 4.281 5.525 7.394 7.92l-3.113 2.408 1.042 1.364L8.878 8.95l-.495 3.29 1.697.255.682-4.575-.682-4.562Z"
      fill="#E2E2E8"
    />
    <Rect x={0.5} y={0.5} width={15} height={15} rx={7.5} stroke="#1E1E2A" />
  </Svg>
);
export default SvgKaspa;
