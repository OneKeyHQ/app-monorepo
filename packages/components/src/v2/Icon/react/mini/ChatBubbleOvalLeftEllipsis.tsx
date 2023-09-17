import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChatBubbleOvalLeftEllipsis = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 20 20"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M10 3c-4.31 0-8 3.033-8 7 0 2.024.978 3.825 2.499 5.085a3.478 3.478 0 0 1-.522 1.756.75.75 0 0 0 .584 1.143 5.976 5.976 0 0 0 3.936-1.108c.487.082.99.124 1.503.124 4.31 0 8-3.033 8-7s-3.69-7-8-7zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-2-1a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm5 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChatBubbleOvalLeftEllipsis;
