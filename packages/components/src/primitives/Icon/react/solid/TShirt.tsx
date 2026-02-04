import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTShirt = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M9.53 3.606c-.35-.494-.992-.787-1.535-.521l-6.03 2.953a1.49 1.49 0 0 0-.779 1.734l.484 1.74a1.487 1.487 0 0 0 1.89 1.018l1.499-.486v8.896c0 1.095.887 1.983 1.983 1.983h9.915a1.983 1.983 0 0 0 1.983-1.983v-8.896l1.498.486a1.487 1.487 0 0 0 1.892-1.017l.483-1.741a1.49 1.49 0 0 0-.779-1.734l-6.03-2.953c-.543-.266-1.185.027-1.534.521-1.233 1.748-3.708 1.748-4.942 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTShirt;
