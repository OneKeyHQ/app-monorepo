import React, { FC } from 'react';

import { StyleSheet, TextStyle } from 'react-native';
import RNMarkdown from 'react-native-markdown-display';

import { useIsVerticalLayout, useThemeValue } from '../Provider/hooks';
import {
  Body1Props,
  Body2Props,
  DisplayMediumProps,
  DisplaySmallProps,
} from '../Typography';

// all markdown style
// https://github.com/iamacup/react-native-markdown-display/blob/master/src/lib/styles.js

const Markdown: FC = ({ children }) => {
  const headingColor = useThemeValue('text-default');
  const bodyTextColor = useThemeValue('text-subdued');
  // const bgColor = useThemeValue('surface-default');
  const isSmallScreen = useIsVerticalLayout();
  const horizontalRulesColor = useThemeValue('divider');

  const styles = StyleSheet.create({
    body: {
      color: bodyTextColor,
      ...(isSmallScreen
        ? (Body1Props as TextStyle)
        : (Body2Props as TextStyle)),
    },
    paragraph: {
      marginVertical: 4,
    },
    heading1: { color: headingColor, ...(DisplayMediumProps as TextStyle) },
    heading2: {
      marginTop: 24,
      marginBottom: 4,
      color: headingColor,
      ...(DisplaySmallProps as TextStyle),
    },
    list_item: {
      marginVertical: 4,
      flexDirection: 'row',
    },
    hr: {
      marginVertical: 24,
      backgroundColor: horizontalRulesColor,
      height: 1,
    },
  });

  return (
    <RNMarkdown
      mergeStyle={false}
      style={styles}
      // style={{
      //   body: { color: primaryTextColor },
      //   code_inline: { padding: 2, backgroundColor: bgColor, borderWidth: 0 },
      //   blockquote: { backgroundColor: bgColor, borderWidth: 0 },
      //   code_block: { backgroundColor: bgColor, borderWidth: 0 },
      //   fence: { backgroundColor: bgColor, borderWidth: 0 },
      // }}
    >
      {children}
    </RNMarkdown>
  );
};

export default Markdown;
