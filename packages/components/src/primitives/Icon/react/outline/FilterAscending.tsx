import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFilterAscending = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6 4a1 1 0 1 1 2 0v13.586l1.293-1.293a1 1 0 1 1 1.414 1.414l-3 3a1 1 0 0 1-1.414 0l-3-3a1 1 0 1 1 1.414-1.414L6 17.586zm14 9a1 1 0 0 1 .769 1.64L17.136 19H20a1 1 0 1 1 0 2h-5a1 1 0 0 1-.768-1.64L17.864 15H15a1 1 0 1 1 0-2zM17.5 3c.76 0 1.437.466 1.714 1.163l.05.143 1.184 3.878.5 1.5a1 1 0 0 1-1.896.632l-.273-.816h-2.558l-.273.816a1 1 0 1 1-1.896-.632l.5-1.5 1.184-3.878.05-.143A1.84 1.84 0 0 1 17.5 3m-.65 4.5h1.3l-.65-2.125z" />
  </Svg>
);
export default SvgFilterAscending;
