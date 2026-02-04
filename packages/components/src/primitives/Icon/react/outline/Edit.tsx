import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEdit = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11.043 2.957a1 1 0 1 1 0 2h-6v14h14v-6a1 1 0 1 1 2 0v6a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2v-14a2 2 0 0 1 2-2z" />
    <Path
      fillRule="evenodd"
      d="M16.879 2.707a2 2 0 0 1 2.828 0l1.586 1.586a2 2 0 0 1 0 2.828l-8.25 8.25a2 2 0 0 1-1.414.586H9.043a1 1 0 0 1-1-1v-2.586a2 2 0 0 1 .586-1.414zm-6.836 9.664v1.586h1.586l8.25-8.25-1.586-1.586z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgEdit;
