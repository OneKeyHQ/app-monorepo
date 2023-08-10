import Svg, { SvgProps, Rect, Path } from 'react-native-svg';
const SvgAurora = (props: SvgProps) => (
  <Svg viewBox="0 0 16 16" fill="none" accessibilityRole="image" {...props}>
    <Rect x={0.5} y={0.5} width={15} height={15} rx={7.5} fill="#303040" />
    <Path
      d="m6.707 4.323-2.76 5.493A1.3 1.3 0 0 0 5.108 11.7h5.493a1.3 1.3 0 0 0 1.164-1.879L9.033 4.328c-.477-.96-1.845-.962-2.326-.005Z"
      stroke="#E2E2E8"
      strokeWidth={0.7}
    />
    <Rect x={0.5} y={0.5} width={15} height={15} rx={7.5} stroke="#1E1E2A" />
  </Svg>
);
export default SvgAurora;
