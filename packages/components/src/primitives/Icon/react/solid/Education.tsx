import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEducation = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12.38 3.844a.92.92 0 0 0-.76 0L1.538 8.427a.917.917 0 0 0 0 1.67l10.084 4.583c.24.11.517.11.758 0l8.788-3.995v4.993a.917.917 0 0 0 1.833 0V9.262c0-.36-.21-.686-.537-.835L12.379 3.844Z" />
    <Path
      fillRule="evenodd"
      d="M5.125 12.746v3.018c0 .68.377 1.305.979 1.622l5.042 2.655a1.83 1.83 0 0 0 1.708 0l5.042-2.655c.602-.317.979-.942.979-1.622v-3.018l-6.459 3.289a.92.92 0 0 1-.832 0z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgEducation;
