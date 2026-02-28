import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCallCancel = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M21.414 4 4 21.414 2.586 20l4.707-4.707A16.94 16.94 0 0 1 3 4V3h6.544l1.586 5.285L9.536 9.88c.375.665.81 1.291 1.3 1.87L20 2.586zM21 14.456V21h-1c-3.61 0-6.959-1.125-9.712-3.045l3.616-3.616q.108.064.218.126l1.593-1.594z" />
  </Svg>
);
export default SvgCallCancel;
