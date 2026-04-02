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
      d="M18.112 8.834c2.362 0 3.888 1.218 3.888 3.06v6.265h-2.49v-1.364h-.05c-.52.938-1.492 1.51-2.694 1.51-1.833 0-3.069-1.152-3.069-2.764v-.016c0-1.662 1.287-2.634 3.555-2.78l2.259-.135v-.564c0-.809-.529-1.312-1.5-1.312-.93 0-1.492.435-1.612 1.023l-.017.077h-2.276l.008-.103c.137-1.688 1.586-2.897 3.998-2.897m-.485 5.447c-.963.06-1.467.468-1.467 1.116v.018c0 .673.555 1.073 1.415 1.073 1.117 0 1.936-.716 1.936-1.671v-.656zM8.322 5.858l4.288 12.3H9.908l-.929-2.983H4.632l-.93 2.984H1L5.297 5.858zM6.78 8.245l-1.55 5.004h3.154L6.83 8.245z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTitleCase;
