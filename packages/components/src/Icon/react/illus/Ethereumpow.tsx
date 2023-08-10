import Svg, { SvgProps, Rect, G, Path, Defs, ClipPath } from 'react-native-svg';
const SvgEthereumpow = (props: SvgProps) => (
  <Svg viewBox="0 0 16 16" fill="none" accessibilityRole="image" {...props}>
    <Rect x={0.5} y={0.5} width={15} height={15} rx={7.5} fill="#303040" />
    <G clipPath="url(#a)">
      <Path
        d="m4 8.047 4-6.66v4.978L4 8.047ZM12 8.047l-4-6.66v4.978l4 1.682Z"
        fill="#E2E2E8"
      />
      <Path
        d="M8 6.35 4 8.036l4 2.333V6.35ZM8 6.35l4 1.687-4 2.333V6.35ZM4 8.815l4 5.799v-3.46l-4-2.34ZM12 8.815l-4 5.799v-3.46l4-2.34Z"
        fill="#E2E2E8"
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6.35 5.09c0 .258-.199.47-.45.49l.159 2.923h.005a.49.49 0 0 1 .273.083l1.356-1.83a.491.491 0 1 1 .576.035l1.319 1.78a.49.49 0 0 1 .248-.068h.005L10 5.577a.492.492 0 1 1 .047.005l-.16 2.924a.492.492 0 1 1-.34.09l-1.32-1.781a.49.49 0 0 1-.497-.03L6.375 8.614a.491.491 0 1 1-.364-.108l-.16-2.924a.492.492 0 1 1 .498-.492Z"
        fill="#8C8CA1"
      />
    </G>
    <Rect x={0.5} y={0.5} width={15} height={15} rx={7.5} stroke="#1E1E2A" />
    <Defs>
      <ClipPath id="a">
        <Path fill="#fff" transform="translate(4 1.386)" d="M0 0h8v13.227H0z" />
      </ClipPath>
    </Defs>
  </Svg>
);
export default SvgEthereumpow;
