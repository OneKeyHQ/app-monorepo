import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBrush = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M18.5 6.086V7.5h1.414l3 3-9.414 9.415-1.085-1.086a2 2 0 0 0-2.83-.001l-4.084 4.086L1.086 18.5l4.086-4.086a2 2 0 0 0-.001-2.83l-1.085-1.083L13.5 1.086zM6.896 10.519a4 4 0 0 1-.31 5.309L3.915 18.5l1.586 1.586 2.67-2.672a4 4 0 0 1 5.31-.31l1.605-1.604L8.5 8.914z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBrush;
