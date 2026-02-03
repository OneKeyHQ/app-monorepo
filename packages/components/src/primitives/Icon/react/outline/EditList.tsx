import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEditList = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15.44 8.1a1.956 1.956 0 0 1 2.765 0l2.396 2.396a1.956 1.956 0 0 1 0 2.766l-8.24 8.24a.98.98 0 0 1-.691.286H7.89a.98.98 0 0 1-.977-.977v-3.78c0-.259.103-.508.286-.69zm-6.572 9.336v2.397h2.397l7.953-7.954-2.396-2.396zm-1.955-6.403a.978.978 0 1 1 0 1.956H3.978a.978.978 0 1 1 0-1.956zm3.422-3.91a.978.978 0 1 1 0 1.955H3.98a.978.978 0 1 1 0-1.955zm9.288-3.911a.978.978 0 1 1 0 1.955H3.98a.978.978 0 1 1 0-1.955z" />
  </Svg>
);
export default SvgEditList;
