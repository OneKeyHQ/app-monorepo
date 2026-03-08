import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCallCancel = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21.414 4 4 21.414 2.586 20l4.707-4.707A16.94 16.94 0 0 1 3 4V3h6.544l1.586 5.285L9.536 9.88c.375.665.81 1.291 1.3 1.87L20 2.586zM5.034 5a14.94 14.94 0 0 0 3.676 8.876l.709-.708A14 14 0 0 1 7.41 10.13l-.312-.64L8.87 7.715 8.056 5z"
      clipRule="evenodd"
    />
    <Path d="M21 14.456V21h-1c-3.61 0-6.959-1.125-9.712-3.045l1.44-1.44A14.9 14.9 0 0 0 19 18.969v-3.024l-2.715-.814-1.773 1.773-.642-.312q-.735-.36-1.419-.798l1.453-1.454q.108.064.218.126l1.593-1.594z" />
  </Svg>
);
export default SvgCallCancel;
