/**
 * HyperLiquid API 错误消息 i18n 解析器
 *
 * 职责:
 * 1. 根据服务端提供的 locale 配置,将英文错误消息转换为本地化消息
 * 2. 支持 exact(精确匹配) 和 regex(正则匹配) 两种匹配模式
 * 3. 支持变量占位符替换 {{variable}}
 * 4. 支持 fallback 到本地存储获取 locale 数据
 */

import type { IHyperLiquidErrorLocaleItem } from '@onekeyhq/shared/types/hyperliquid/types';

const PLACEHOLDER_REGEX = /\{\{(\w+)\}\}/g;

type IResolvedError = {
  i18nKey?: string;
  rawMessage: string;
  localizedMessage: string;
  variables?: Record<string, string>;
};

type ILocaleDataProvider = () => Promise<
  IHyperLiquidErrorLocaleItem[] | undefined
>;

class HyperLiquidErrorResolver {
  private locales: IHyperLiquidErrorLocaleItem[] = [];

  private compiledMatchers = new Map<string, RegExp | string>();

  private localeProvider?: ILocaleDataProvider;

  /**
   * 设置 locale 数据提供者(用于 fallback)
   */
  setLocaleProvider(provider: ILocaleDataProvider): void {
    this.localeProvider = provider;
  }

  /**
   * 更新内存中的 locale 数据
   */
  updateLocales(locales: IHyperLiquidErrorLocaleItem[] | undefined): void {
    this.locales = locales || [];
    this.compileMatchers();
  }

  /**
   * 预编译所有匹配器(提升性能)
   */
  private compileMatchers(): void {
    this.compiledMatchers.clear();

    this.locales.forEach((item) => {
      const key = item.i18nKey;
      const { matcher } = item;

      if (matcher.type === 'regex' && matcher.pattern) {
        try {
          this.compiledMatchers.set(key, new RegExp(matcher.pattern));
        } catch (error) {
          console.error(
            `[HyperLiquidErrorResolver] Invalid regex pattern for ${key}:`,
            matcher.pattern,
          );
        }
      } else if (matcher.type === 'exact' && matcher.value) {
        this.compiledMatchers.set(key, matcher.value);
      }
    });
  }

  /**
   * 同步解析错误消息(使用内存中的 locale 数据)
   */
  resolve(rawMessage: string): IResolvedError {
    if (!rawMessage) {
      return { rawMessage: '', localizedMessage: '' };
    }

    if (this.locales.length === 0) {
      return { rawMessage, localizedMessage: rawMessage };
    }

    return this.matchAndResolve(rawMessage);
  }

  /**
   * 异步解析错误消息(支持 fallback 到本地存储)
   */
  async resolveAsync(rawMessage: string): Promise<IResolvedError> {
    if (!rawMessage) {
      return { rawMessage: '', localizedMessage: '' };
    }

    // 1. 尝试使用内存中的数据
    if (this.locales.length > 0) {
      return this.matchAndResolve(rawMessage);
    }

    // 2. Fallback: 从本地存储加载
    if (this.localeProvider) {
      try {
        const locales = await this.localeProvider();
        if (locales && locales.length > 0) {
          this.updateLocales(locales);
          return this.matchAndResolve(rawMessage);
        }
      } catch (error) {
        console.error(
          '[HyperLiquidErrorResolver] Failed to load locales from provider:',
          error,
        );
      }
    }

    // 3. 无可用数据,返回原始消息
    return { rawMessage, localizedMessage: rawMessage };
  }

  /**
   * 核心匹配和解析逻辑
   */
  private matchAndResolve(rawMessage: string): IResolvedError {
    for (const item of this.locales) {
      const compiled = this.compiledMatchers.get(item.i18nKey);
      // eslint-disable-next-line no-continue
      if (!compiled) continue;

      const variables = this.extractVariables(compiled, rawMessage);
      if (variables !== undefined) {
        return {
          i18nKey: item.i18nKey,
          rawMessage: this.fillTemplate(item.rawMessage, variables),
          localizedMessage: this.fillTemplate(item.localizedMessage, variables),
          variables,
        };
      }
    }

    // 未匹配到任何规则,返回原始消息
    return { rawMessage, localizedMessage: rawMessage };
  }

  /**
   * 提取变量(支持 exact 和 regex 两种模式)
   */
  private extractVariables(
    compiled: RegExp | string,
    raw: string,
  ): Record<string, string> | undefined {
    // Exact match: 完全匹配才返回空对象
    if (typeof compiled === 'string') {
      return compiled === raw ? {} : undefined;
    }

    // Regex match: 使用命名捕获组提取变量
    const match = compiled.exec(raw);
    if (!match) return undefined;

    return match.groups || {};
  }

  /**
   * 填充模板占位符 {{variable}}
   */
  private fillTemplate(
    template: string,
    variables: Record<string, string>,
  ): string {
    return template.replace(
      PLACEHOLDER_REGEX,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/restrict-template-expressions
      (_, key) => variables[key] ?? `{{${key}}}`,
    );
  }
}

// 全局单例
export const hyperLiquidErrorResolver = new HyperLiquidErrorResolver();

type IHyperLiquidApiErrorResponse = {
  status: 'err';
  response: unknown;
};

type IHyperLiquidApiRequestError = Error & {
  response?: IHyperLiquidApiErrorResponse;
};

/**
 * 统一封装 HyperLiquid API 响应,在捕获错误时自动执行 i18n 消息转换。
 */
export async function convertHyperLiquidResponse<T>(
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const apiError = error as IHyperLiquidApiRequestError;
    const { response } = apiError;

    if (response?.status === 'err' && typeof response.response === 'string') {
      const originalMessage = response.response;
      const resolved = await hyperLiquidErrorResolver.resolveAsync(
        originalMessage,
      );

      if (
        resolved.localizedMessage &&
        resolved.localizedMessage !== originalMessage
      ) {
        apiError.message = resolved.localizedMessage;
      }
    }

    throw error;
  }
}
