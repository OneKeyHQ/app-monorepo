import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFolderDisable = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M3.243 11.828a5.002 5.002 0 0 1 6.928 6.929l.073.072-1.414 1.414-.073-.072a5 5 0 0 1-6.928-6.929l-.07-.07 1.413-1.414.07.07Zm.051 2.88a2.996 2.996 0 0 0 3.996 3.996zm4.828-.83a3 3 0 0 0-3.413-.583l3.996 3.995a3 3 0 0 0-.583-3.411Z"
      clipRule="evenodd"
    />
    <Path d="M12.536 6H22v14H12v-2h8V8h-8.535l-2-3H4v5H2V3h8.536z" />
  </Svg>
);
export default SvgFolderDisable;
