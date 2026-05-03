import axios from 'axios';

import type { AxiosResponse } from 'axios';

export type IServiceMockStatus = 200 | 401 | 403 | 404 | 500;
export type IServiceMockMethod = 'get' | 'post' | 'delete';

const STATUS_TEXT: Record<IServiceMockStatus, string> = {
  200: 'OK',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  500: 'Internal Server Error',
};

function createResponse<T>(
  status: IServiceMockStatus,
  data: T,
): AxiosResponse<T> {
  return {
    data,
    status,
    statusText: STATUS_TEXT[status],
    headers: {},
    config: { headers: {} },
  } as AxiosResponse<T>;
}

function createError<T>(status: Exclude<IServiceMockStatus, 200>, data: T) {
  return Object.assign(new Error(`HTTP ${status}`), {
    response: createResponse(status, data),
  });
}

export function createServiceMock() {
  const getSpy = jest.spyOn(axios, 'get');
  const postSpy = jest.spyOn(axios, 'post');
  const deleteSpy = jest.spyOn(axios, 'delete');

  const spies = {
    get: getSpy,
    post: postSpy,
    delete: deleteSpy,
  } satisfies Record<IServiceMockMethod, jest.SpyInstance>;

  function mockOnce<T>(
    method: IServiceMockMethod,
    status: IServiceMockStatus,
    data: T,
  ): void {
    if (status === 200) {
      spies[method].mockResolvedValueOnce(createResponse(status, data));
      return;
    }
    spies[method].mockRejectedValueOnce(createError(status, data));
  }

  return {
    spies,
    mockOnce,
    mockGet<T>(status: IServiceMockStatus, data: T): void {
      mockOnce('get', status, data);
    },
    mockPost<T>(status: IServiceMockStatus, data: T): void {
      mockOnce('post', status, data);
    },
    mockDelete<T>(status: IServiceMockStatus, data: T): void {
      mockOnce('delete', status, data);
    },
    restore(): void {
      getSpy.mockRestore();
      postSpy.mockRestore();
      deleteSpy.mockRestore();
    },
  };
}
