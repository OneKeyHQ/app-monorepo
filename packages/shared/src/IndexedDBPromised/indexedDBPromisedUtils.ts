function newAbortError(): DOMException {
  return new DOMException('AbortError', 'AbortError');
}

function newRequestError(): DOMException {
  return new DOMException('DBRequestError', 'DBRequestError');
}

function newDBOpenError(): DOMException {
  return new DOMException('DBOpenError', 'DBOpenError');
}

function toPromiseResult<TResult>({
  request,
}: {
  request: IDBRequest<TResult>;
}): Promise<TResult> {
  return new Promise((resolve, reject) => {
    request.onerror = (event) => {
      const target = event.target as IDBRequest<TResult>;
      reject(target?.error || newRequestError());
    };
    request.onsuccess = (event) => {
      const target = event.target as IDBRequest<TResult>;
      resolve(target?.result);
    };
  });
}

export default {
  toPromiseResult,
  newAbortError,
  newRequestError,
  newDBOpenError,
};
