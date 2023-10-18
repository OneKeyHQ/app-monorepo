import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFileLock = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="m13.586 3.586.707-.707-.707.707Zm4.828 4.828-.707.707.707-.707ZM4 10.5a1 1 0 1 0 2 0H4ZM14 20a1 1 0 1 0 0 2v-2Zm0-16.5v-1h-2v1h2Zm4.5 6.5h1V8h-1v2ZM7 4h5.172V2H7v2Zm11 5.828V19h2V9.828h-2Zm-5.121-5.535 4.828 4.828 1.414-1.414-4.828-4.828-1.414 1.414ZM6 10.5V5H4v5.5h2ZM17 20h-3v2h3v-2Zm3-10.172a3 3 0 0 0-.879-2.12L17.707 9.12a1 1 0 0 1 .293.707h2ZM12.172 4a1 1 0 0 1 .707.293l1.414-1.414A3 3 0 0 0 12.172 2v2ZM18 19a1 1 0 0 1-1 1v2a3 3 0 0 0 3-3h-2ZM7 2a3 3 0 0 0-3 3h2a1 1 0 0 1 1-1V2Zm5 1.5V7h2V3.5h-2Zm3 6.5h3.5V8H15v2Zm-3-3a3 3 0 0 0 3 3V8a1 1 0 0 1-1-1h-2ZM5 18h4v-2H5v2Zm4 0v2h2v-2H9Zm0 2H5v2h4v-2Zm-4 0v-2H3v2h2Zm0 0H3a2 2 0 0 0 2 2v-2Zm4 0v2a2 2 0 0 0 2-2H9Zm0-2h2a2 2 0 0 0-2-2v2Zm-4-2a2 2 0 0 0-2 2h2v-2Zm3 0v1h2v-1H8Zm-2 1v-1H4v1h2Zm1-2a1 1 0 0 1 1 1h2a3 3 0 0 0-3-3v2Zm0-2a3 3 0 0 0-3 3h2a1 1 0 0 1 1-1v-2Z"
    />
  </Svg>
);
export default SvgFileLock;
