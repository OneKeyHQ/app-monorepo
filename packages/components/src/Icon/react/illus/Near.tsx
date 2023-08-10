import Svg, { SvgProps, Rect, Path } from 'react-native-svg';
const SvgNear = (props: SvgProps) => (
  <Svg viewBox="0 0 16 16" fill="none" accessibilityRole="image" {...props}>
    <Rect x={0.5} y={0.5} width={15} height={15} rx={7.5} fill="#303040" />
    <Path
      d="M10.421 4.406 8.75 6.89a.178.178 0 0 0 .264.233l1.646-1.428a.066.066 0 0 1 .111.051v4.47a.066.066 0 0 1-.044.063.067.067 0 0 1-.074-.02L5.677 4.302A.853.853 0 0 0 5.027 4h-.175A.852.852 0 0 0 4 4.852v6.296a.852.852 0 0 0 1.579.446L7.25 9.11a.178.178 0 0 0-.264-.233l-1.646 1.428a.067.067 0 0 1-.072.01.067.067 0 0 1-.039-.061V5.784a.067.067 0 0 1 .118-.043l4.975 5.957a.853.853 0 0 0 .65.302h.174a.851.851 0 0 0 .853-.852V4.852a.852.852 0 0 0-1.579-.446Z"
      fill="#E2E2E8"
    />
    <Rect x={0.5} y={0.5} width={15} height={15} rx={7.5} stroke="#1E1E2A" />
  </Svg>
);
export default SvgNear;
