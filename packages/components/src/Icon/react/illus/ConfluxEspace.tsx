import Svg, { SvgProps, Rect, Path } from 'react-native-svg';
const SvgConfluxEspace = (props: SvgProps) => (
  <Svg viewBox="0 0 16 16" fill="none" accessibilityRole="image" {...props}>
    <Rect x={0.5} y={0.5} width={15} height={15} rx={7.5} fill="#303040" />
    <Path
      d="m4.627 10.135 3.428-3.428L9.1 7.75l-2.385 2.385 1.341 1.341 2.385-2.385 1.043 1.044-3.428 3.428-3.428-3.428Z"
      fill="#E2E2E8"
    />
    <Path
      d="M3.6 6.972v2.12L8.04 4.652l4.438 4.438v-2.12L8.039 2.534 3.6 6.972Z"
      fill="#E2E2E8"
    />
    <Rect x={0.5} y={0.5} width={15} height={15} rx={7.5} stroke="#1E1E2A" />
  </Svg>
);
export default SvgConfluxEspace;
