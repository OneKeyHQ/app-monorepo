import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgX = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M17.728 3h3.053l-6.67 7.625L21.959 21h-6.146l-4.812-6.293L5.494 21H2.438l7.136-8.155L2.044 3h6.302l4.35 5.752zm-1.072 16.172h1.692L7.426 4.732H5.611z"
    />
  </Svg>
);
export default SvgX;
