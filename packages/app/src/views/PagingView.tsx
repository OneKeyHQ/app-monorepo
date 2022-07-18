import React, { FC } from 'react';

import PropTypes from 'prop-types';
import { requireNativeComponent } from 'react-native';

const NativePagingView = requireNativeComponent('PagingView');

const PagingView: FC = () => <NativePagingView style={{ flex: 1 }} />;

// class PagingView extends React.Component {
//   render() {
//     return <NativePagingView {...this.props} renderItem={this._renderItem} />;
//   }
// }

// PagingView.propTypes = {
//   onChange: PropTypes.func,
//   headerView: PropTypes.element,
// };

export default PagingView;
