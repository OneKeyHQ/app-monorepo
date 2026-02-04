import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLibrary = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16.697 6.003a1.5 1.5 0 0 1 1.855 1.029l3.308 11.535a1.5 1.5 0 0 1-1.029 1.855l-1.923.552a1.5 1.5 0 0 1-1.855-1.03L13.745 8.412a1.5 1.5 0 0 1 1.03-1.856l1.921-.552ZM4.082 4.968a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1-1.5 1.5h-.5a1.5 1.5 0 0 1-1.5-1.5v-13a1.5 1.5 0 0 1 1.5-1.5z" />
    <Path
      fillRule="evenodd"
      d="M12.082 2.968a1.5 1.5 0 0 1 1.5 1.5v15a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5v-15a1.5 1.5 0 0 1 1.5-1.5zm-3.5 12a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5zm0-8a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLibrary;
