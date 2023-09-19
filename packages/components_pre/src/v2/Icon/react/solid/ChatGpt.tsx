import Svg, { Path } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

const SvgChatGpt = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M11.11 4C9.536 4 8.22 5.026 7.804 6.406c-.09.3-.14.618-.14.949v2.911a1 1 0 0 0 .5.866l.639.37.032-3.176a3 3 0 0 1 1.524-2.58l2.383-1.348A3.504 3.504 0 0 0 11.111 4ZM15 3.607A5.48 5.48 0 0 0 11.11 2a5.45 5.45 0 0 0-5.006 3.242 5.423 5.423 0 0 0-3.369 2.504 5.281 5.281 0 0 0 .354 5.9 5.262 5.262 0 0 0 .536 4.116c1.132 1.92 3.282 2.881 5.374 2.631A5.48 5.48 0 0 0 12.889 22a5.45 5.45 0 0 0 5.007-3.242 5.423 5.423 0 0 0 3.369-2.504 5.281 5.281 0 0 0-.353-5.898 5.262 5.262 0 0 0-.535-4.118C19.245 4.32 17.096 3.355 15 3.607Zm4.11 5.23a3.272 3.272 0 0 0-.456-1.584c-.947-1.605-3.06-2.17-4.721-1.23l-2.59 1.464a1 1 0 0 0-.509.86l-.007.68L13.72 7.43a3 3 0 0 1 2.927.014l2.463 1.393Zm-8.306 2.488-.014 1.327 1.196.692 1.212-.67.014-1.325-1.198-.693-1.21.669Zm3.253-1.797 2.782 1.61a3 3 0 0 1 1.497 2.596v2.706a3.384 3.384 0 0 0 1.206-1.202 3.288 3.288 0 0 0-.48-3.97 3.436 3.436 0 0 0-.778-.6l-2.622-1.483a1 1 0 0 0-.975-.005l-.63.348ZM15.2 12.5l-.033 3.173a3 3 0 0 1-1.523 2.58l-2.385 1.35a3.504 3.504 0 0 0 1.63.397c1.576 0 2.89-1.026 3.308-2.406.09-.3.14-.618.14-.949v-2.911a1 1 0 0 0-.5-.866L15.2 12.5Zm-2.025 2.472L10.28 16.57a3 3 0 0 1-2.927-.014l-2.462-1.392a3.27 3.27 0 0 0 .457 1.582c.776 1.316 2.338 1.937 3.797 1.593.316-.074.627-.194.924-.361l2.59-1.465a1 1 0 0 0 .508-.86l.008-.681Zm-3.232-.5-2.782-1.61a3 3 0 0 1-1.497-2.596V7.56a3.385 3.385 0 0 0-1.206 1.202 3.288 3.288 0 0 0 .48 3.972c.222.228.482.43.778.599l2.622 1.482a1 1 0 0 0 .975.005l.63-.348Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChatGpt;
