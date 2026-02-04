import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPencil = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M15.129 2.957a2 2 0 0 1 2.828 0l3.086 3.086a2 2 0 0 1 .138 2.676l-.138.152-12.5 12.5a2 2 0 0 1-1.414.586H4.043a2 2 0 0 1-2-2v-3.086a2 2 0 0 1 .586-1.414zM4.043 16.871v3.086h3.086l9.5-9.5-3.086-3.086zM14.957 5.957l3.086 3.086 1.586-1.586-3.086-3.086z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPencil;
