import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFolderUser = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M6 16a5 5 0 0 1 4.843 3.751L11.164 21H.836l.321-1.249A5 5 0 0 1 6 16m0 2c-.887 0-1.685.387-2.234 1h4.468c-.55-.613-1.347-1-2.234-1"
      clipRule="evenodd"
    />
    <Path d="M12.535 6H22v14h-9v-2h7V8h-8.535l-2-3H4v3H2V3h8.535z" />
    <Path
      fillRule="evenodd"
      d="M6 9.75a2.75 2.75 0 1 1 0 5.5 2.75 2.75 0 0 1 0-5.5m0 2a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFolderUser;
