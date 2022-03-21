require('./env');

function normalizeConfig(config) {
  config.plugins = [
    ...(config.plugins || []),
    [
      // Expose env variable to client-side app code
      'transform-inline-environment-variables',
      {
        // *** ATTENTION: DO NOT expose sensitive variable here ***
        'include': ['NODE_ENV', 'REMOTE_CONSOLE_SERVER'],
      },
    ],
    /*
    support lodash import in Ext background like this:
      import { isFunction } from 'lodash';

    error in ui:
       Unchecked runtime.lastError: Could not establish connection. Receiving end does not exist.
    and background code will never be executed.
     */
    ['babel-plugin-lodash'],
    [
      'babel-plugin-inline-import',
      {
        'extensions': ['.text-js'],
      },
    ],
    /* FIX:
       TypeError: undefiend is not an object (evaluating 'this._callListeners.bind')
     */
    ['@babel/plugin-transform-flow-strip-types'],
    ['@babel/plugin-proposal-decorators', { 'legacy': true }],
    ['@babel/plugin-proposal-class-properties', { 'loose': true }],
    ['@babel/plugin-proposal-private-methods', { 'loose': true }],
    ['@babel/plugin-proposal-private-property-in-object', { 'loose': true }],
  ];
  return config;
}

module.exports = {
  normalizeConfig,
};
