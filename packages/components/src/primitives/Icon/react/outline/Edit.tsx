import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEdit = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 5H5v14h14v-7h2v9H3V3h9z" />
    <Path
      fillRule="evenodd"
      d="m22.414 6-10 10H8v-4.414l10-10zM10 12.414V14h1.586l8-8L18 4.414z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgEdit;
