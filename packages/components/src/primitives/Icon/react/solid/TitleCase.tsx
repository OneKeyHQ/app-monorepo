import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTitleCase = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M18.112 8.833c2.362 0 3.888 1.219 3.888 3.06v6.265h-2.49v-1.363h-.05c-.52.938-1.492 1.509-2.694 1.509-1.833 0-3.069-1.152-3.069-2.763v-.017c0-1.662 1.287-2.634 3.555-2.779l2.259-.136v-.563c0-.81-.529-1.312-1.5-1.313-.93 0-1.492.436-1.612 1.024l-.017.076h-2.276l.008-.103c.137-1.687 1.586-2.897 3.998-2.897m-.485 5.447c-.963.06-1.467.469-1.467 1.117v.017c0 .673.555 1.073 1.415 1.073 1.117 0 1.936-.716 1.936-1.67v-.657zM8.322 5.857l4.288 12.301H9.908l-.929-2.983H4.632l-.93 2.983H1l4.297-12.3h3.025ZM6.78 8.244l-1.55 5.004h3.154L6.83 8.244z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTitleCase;
