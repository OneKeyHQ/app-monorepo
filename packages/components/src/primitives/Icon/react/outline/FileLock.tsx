import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFileLock = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="m13.586 3.586.707-.707zm4.828 4.828-.707.707zM4 10.5a1 1 0 1 0 2 0zM14 20a1 1 0 1 0 0 2zm0-16.5v-1h-2v1zm4.5 6.5h1V8h-1zM7 4h5.172V2H7zm11 5.828V19h2V9.828zm-5.121-5.535 4.828 4.828 1.414-1.414-4.828-4.828zM6 10.5V5H4v5.5zM17 20h-3v2h3zm3-10.172a3 3 0 0 0-.879-2.12L17.707 9.12a1 1 0 0 1 .293.707zM12.172 4a1 1 0 0 1 .707.293l1.414-1.414A3 3 0 0 0 12.172 2zM18 19a1 1 0 0 1-1 1v2a3 3 0 0 0 3-3zM7 2a3 3 0 0 0-3 3h2a1 1 0 0 1 1-1zm5 1.5V7h2V3.5zm3 6.5h3.5V8H15zm-3-3a3 3 0 0 0 3 3V8a1 1 0 0 1-1-1zM5 18h4v-2H5zm4 0v2h2v-2zm0 2H5v2h4zm-4 0v-2H3v2zm0 0H3a2 2 0 0 0 2 2zm4 0v2a2 2 0 0 0 2-2zm0-2h2a2 2 0 0 0-2-2zm-4-2a2 2 0 0 0-2 2h2zm3 0v1h2v-1zm-2 1v-1H4v1zm1-2a1 1 0 0 1 1 1h2a3 3 0 0 0-3-3zm0-2a3 3 0 0 0-3 3h2a1 1 0 0 1 1-1z"
    />
  </Svg>
);
export default SvgFileLock;
