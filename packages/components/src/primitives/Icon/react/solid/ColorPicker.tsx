import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgColorPicker = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M15.305 3.401a1.955 1.955 0 0 1 2.766 0l2.528 2.528a1.956 1.956 0 0 1 0 2.766l-3.995 3.994.775.776a.978.978 0 1 1-1.382 1.382l-.776-.775-6.355 6.355A1.96 1.96 0 0 1 7.484 21H4.955A1.955 1.955 0 0 1 3 19.044v-2.528c0-.518.206-1.016.573-1.382l6.355-6.355-.775-.776a.978.978 0 0 1 1.382-1.382l.775.775zM13.84 12.69l-2.529-2.528-4.972 4.973h5.056z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgColorPicker;
