const enforceReturnTypeRule = {
  meta: {
    type: 'problem',  
    docs: {
      description:
        'Ensure that setRawData callback functions have explicit return types',
      category: 'Best Practices',
      recommended: false,
    },
    schema: [],  
    messages: {
      returnTypeRequired: 'Callback functions for setRawData must explicitly declare a return type',
    },
  },
  create(context) {
    return {
      "CallExpression[callee.property.name='setRawData']": function (node) {
        const callback = node.arguments[0];
        if (
          callback &&
          (callback.type === 'ArrowFunctionExpression' ||
            callback.type === 'FunctionExpression') &&
          !callback.returnType
        ) {
          context.report({
            node: callback,
            message: 'Callback functions for setRawData must explicitly declare a return type',
          });
        }
      },
    };
  },
};

// Export the rule directly
module.exports = {
  // meta: {
  //   name: 'app-eslint-rule',
  //   version: '1.0.0',
  // },
  rules: {
    'enforce-return-type': enforceReturnTypeRule,
  },
};
