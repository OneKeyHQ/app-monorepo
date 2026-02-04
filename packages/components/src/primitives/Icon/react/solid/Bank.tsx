import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBank = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12.889 1.946a1.99 1.99 0 0 0-1.778 0L3.16 5.922A1.99 1.99 0 0 0 2.06 7.7v.38c0 1.097.89 1.987 1.989 1.987v6.097c-.542.21-.978.652-1.169 1.226l-.331.994A1.988 1.988 0 0 0 4.435 21h15.132a1.988 1.988 0 0 0 1.886-2.616l-.331-.994a1.99 1.99 0 0 0-1.17-1.226v-6.097c1.097 0 1.987-.89 1.987-1.988V7.7c0-.752-.425-1.44-1.099-1.777l-7.95-3.977Zm5.075 8.121h-1.988v5.963h1.987zm-3.976 5.963v-5.963h-3.976v5.963zm-5.964 0v-5.963H6.037v5.963z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBank;
