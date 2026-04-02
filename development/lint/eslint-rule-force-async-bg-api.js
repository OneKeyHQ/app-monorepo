module.exports = {
  rules: {
    'force-async-bg-api': {
      meta: {
        type: 'problem', // 规则类型：problem, suggestion, layout
        docs: {
          description:
            'Ensure that methods annotated with @backgroundMethod() are async',
          category: 'Best Practices',
          recommended: false,
        },
        schema: [], // 规则的配置选项
        messages: {
          asyncRequired:
            'Methods annotated with @backgroundMethod() must be declared as async.',
        },
      },
      create(context) {
        return {
          // 监听函数声明
          FunctionDeclaration(node) {
            // 检查函数是否使用了 @backgroundMethod() 装饰器
            const hasBackgroundMethod =
              node.decorators &&
              node.decorators.some(
                (decorator) =>
                  decorator.expression.type === 'CallExpression' &&
                  decorator.expression.callee.name === 'backgroundMethod',
              );

            // 如果使用了 @backgroundMethod() 装饰器，但函数不是 async 的，则报告错误
            if (hasBackgroundMethod && node.async !== true) {
              context.report({
                node,
                messageId: 'asyncRequired',
              });
            }
          },

          // 监听箭头函数表达式
          ArrowFunctionExpression(node) {
            // 检查箭头函数是否使用了 @backgroundMethod() 装饰器
            const hasBackgroundMethod =
              node.parent.type === 'MethodDefinition' &&
              node.parent.decorators &&
              node.parent.decorators.some(
                (decorator) =>
                  decorator.expression.type === 'CallExpression' &&
                  decorator.expression.callee.name === 'backgroundMethod',
              );

            // 如果使用了 @backgroundMethod() 装饰器，但函数不是 async 的，则报告错误
            if (hasBackgroundMethod && node.async !== true) {
              context.report({
                node: node.parent,
                messageId: 'asyncRequired',
              });
            }
          },
        };
      },
    },
  },
};
