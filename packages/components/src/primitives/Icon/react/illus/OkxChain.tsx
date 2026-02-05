import Svg, { G, Path, Defs, ClipPath } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgOkxChain = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 16 16" accessibilityRole="image" {...props}>
    <G clipPath="url(#clip0_149_656)">
      <Path
        fill="#8C8CA1"
        fillRule="evenodd"
        d="M6.111 3H3.222C3.1 3 3 3.1 3 3.222v2.89c0 .122.1.221.222.221h2.89c.122 0 .221-.1.221-.222V3.222c0-.123-.1-.222-.222-.222m3.335 3.333H6.557c-.123 0-.222.1-.222.223v2.888c0 .123.1.223.222.223h2.889c.123 0 .222-.1.222-.223V6.556c0-.123-.1-.223-.222-.223M9.889 3h2.889c.122 0 .222.1.222.222v2.89c0 .122-.1.221-.222.221h-2.89a.22.22 0 0 1-.221-.222V3.222c0-.123.1-.222.222-.222M6.11 9.667H3.222c-.123 0-.222.1-.222.222v2.889c0 .122.1.222.222.222h2.89c.122 0 .221-.1.221-.222v-2.89c0-.122-.1-.221-.222-.221m3.778 0h2.889c.122 0 .222.1.222.222v2.889c0 .122-.1.222-.222.222h-2.89a.22.22 0 0 1-.221-.222v-2.89c0-.122.1-.221.222-.221"
        clipRule="evenodd"
      />
    </G>
    <Defs>
      <ClipPath id="clip0_149_656">
        <Path fill="#fff" d="M3 3h10v10H3z" />
      </ClipPath>
    </Defs>
  </Svg>
);
export default SvgOkxChain;
