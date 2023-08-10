import Svg, { SvgProps, G, Rect, Path, Defs, ClipPath } from 'react-native-svg';
const SvgBnbSmartChain = (props: SvgProps) => (
  <Svg viewBox="0 0 16 16" fill="none" accessibilityRole="image" {...props}>
    <G clipPath="url(#a)">
      <Rect width={16} height={16} rx={8} fill="#303040" />
      <Path fill="#272735" d="M0 0h16v16H0z" />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8.037 9.326 6.67 7.959l1.367-1.366 1.366 1.366-1.366 1.367ZM11.142 7.96l-.006.005 1.268 1.267 1.273-1.273-1.282-1.282-1.268 1.268.015.014Z"
        fill="#E2E2E8"
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="m5.84 7.05 2.196-2.196 2.23 2.229 1.267-1.268L8.036 2.32 4.572 5.783 5.84 7.05ZM10.274 8.827l-2.238 2.238L5.82 8.847 4.55 10.114 8.036 13.6l3.505-3.505-1.267-1.268ZM4.93 7.96l.048-.047L3.71 6.645 2.396 7.959l1.293 1.293 1.267-1.267-.025-.026Z"
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
export default SvgBnbSmartChain;
