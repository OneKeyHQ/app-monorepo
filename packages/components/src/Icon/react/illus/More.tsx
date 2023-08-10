import Svg, { SvgProps, G, Rect, Path, Defs, ClipPath } from 'react-native-svg';
const SvgMore = (props: SvgProps) => (
  <Svg viewBox="0 0 16 16" fill="none" accessibilityRole="image" {...props}>
    <G clipPath="url(#a)">
      <Rect width={16} height={16} rx={8} fill="#303040" />
      <Path fill="#303040" d="M0 0h16v16H0z" />
      <Path
        d="M3.8 8a.9.9 0 1 1 1.8 0 .9.9 0 0 1-1.8 0ZM7.1 8a.9.9 0 1 1 1.8 0 .9.9 0 0 1-1.8 0ZM11.3 7.1a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8Z"
        fill="#E2E2E8"
      />
    </G>
    <Rect x={0.5} y={0.5} width={15} height={15} rx={7.5} stroke="#1E1E2A" />
    <Defs>
      <ClipPath id="a">
        <Rect width={16} height={16} rx={8} fill="#fff" />
      </ClipPath>
    </Defs>
  </Svg>
);
export default SvgMore;
