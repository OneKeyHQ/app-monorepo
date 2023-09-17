import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgScroll = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 16 16" accessibilityRole="image" {...props}>
    <Path
      fill="#8C8CA1"
      d="M11.387 10.741H5.872v.322c0 .732-.177 1.063-.53 1.12a.645.645 0 0 1-.539-.636V4.841c.02-.963-.39-1.53-1.19-1.53v.645c.39 0 .558.234.546.878v6.713c0 .64.469 1.183 1.1 1.276v.014h6.45a1.29 1.29 0 0 0 1.29-1.29v-.806h-.968v-6.29a1.29 1.29 0 0 0-1.29-1.29H4.19c-.772 0-1.19.507-1.19 1.373V6.06h1.48v-.646h-.834v-.879c0-.534.16-.73.545-.73h6.551c.357 0 .646.29.646.647v6.29Zm-1.328 1.452h-3.76c.11-.218.178-.49.204-.806h5.852v.162c0 .356-.29.645-.646.645l-1.65-.001Zm.229-6.608a.322.322 0 1 0 0-.645H5.934a.322.322 0 1 0 0 .645h4.354Zm-.002 1.775a.322.322 0 1 0 0-.645H6.318a.322.322 0 1 0 0 .645h3.968Z"
    />
    <Path
      fill="#8C8CA1"
      d="M10.608 8.802a.322.322 0 0 1-.322.322H6.32a.322.322 0 1 1 0-.644h3.967c.179 0 .322.144.322.322Z"
    />
  </Svg>
);
export default SvgScroll;
