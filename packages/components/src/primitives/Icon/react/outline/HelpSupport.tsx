import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgHelpSupport = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M6 10h1a1 1 0 0 0-1-1v1Zm0 6.5v1a1 1 0 0 0 1-1H6ZM18.5 10V9a1 1 0 0 0-1 1h1Zm0 6.5h-1a1 1 0 0 0 1 1v-1ZM13 19a1 1 0 1 0-2 0h2Zm7.75-2.5a1 1 0 1 0-2 0h2ZM4.5 11H6V9H4.5v2Zm.5-1v6.5h2V10H5Zm1 5.5H4.5v2H6v-2ZM4 15v-3.5H2V15h2Zm.5.5A.5.5 0 0 1 4 15H2a2.5 2.5 0 0 0 2.5 2.5v-2Zm0-6.5A2.5 2.5 0 0 0 2 11.5h2a.5.5 0 0 1 .5-.5V9Zm14 2H20V9h-1.5v2Zm2 .5V15h2v-3.5h-2Zm-.5 4h-1.5v2H20v-2Zm-.5 1V10h-2v6.5h2Zm1-1.5a.5.5 0 0 1-.5.5v2a2.5 2.5 0 0 0 2.5-2.5h-2Zm-.5-4a.5.5 0 0 1 .5.5h2A2.5 2.5 0 0 0 20 9v2ZM6 9.75C6 6.64 8.73 4 12.25 4V2C7.762 2 4 5.404 4 9.75h2ZM12.25 4c3.52 0 6.25 2.64 6.25 5.75h2C20.5 5.404 16.738 2 12.25 2v2ZM4 9.75V10h2v-.25H4Zm14.5 0V10h2v-.25h-2ZM15.25 20H13.5v2h1.75v-2ZM13 19.5V19h-2v.5h2Zm5.75-3a3.5 3.5 0 0 1-3.5 3.5v2a5.5 5.5 0 0 0 5.5-5.5h-2ZM13.5 20a.5.5 0 0 1-.5-.5h-2a2.5 2.5 0 0 0 2.5 2.5v-2Z"
    />
  </Svg>
);
export default SvgHelpSupport;
