import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTranslate = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m22.33 19.481-1.811.85L19.427 18h-4.854l-1.091 2.33-1.812-.849L16.114 10h1.772zM15.51 16h2.98L17 12.822zM9 5h4v2h-1.628c-.312 1.91-.928 3.522-1.933 4.816.75.525 1.673.93 2.804 1.213l.971.242-.485 1.94-.971-.241c-1.46-.366-2.716-.93-3.757-1.727-1.041.798-2.297 1.362-3.759 1.728l-.97.242-.485-1.94.97-.243c1.133-.283 2.056-.687 2.808-1.213C5.558 10.523 4.942 8.911 4.629 7H3V5h4V3h2zM6.66 7c.265 1.413.715 2.526 1.341 3.4.626-.875 1.076-1.987 1.342-3.4H6.659Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTranslate;
