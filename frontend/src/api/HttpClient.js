export class HttpError extends Error {
  constructor(code, statusCode) {
    super(code);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class HttpClient {
  #baseUrl;

  #timeoutMs;

  constructor({ baseUrl, timeoutMs }) {
    this.#baseUrl = baseUrl;
    this.#timeoutMs = timeoutMs;
  }

  async get(path, { allowedStatusCodes = [], timeoutMs, headers } = {}) {
    return this.#request('GET', path, undefined, { allowedStatusCodes, timeoutMs, headers });
  }

  async post(path, body, { timeoutMs, headers } = {}) {
    return this.#request('POST', path, body, { timeoutMs, headers });
  }

  async patch(path, body, { headers } = {}) {
    return this.#request('PATCH', path, body, { headers });
  }

  async put(path, body) {
    return this.#request('PUT', path, body);
  }

  async putImage(path, file) {
    return this.#request('PUT', path, file, { timeoutMs: 30000 });
  }

  async delete(path, { headers } = {}) {
    return this.#request('DELETE', path, undefined, { headers });
  }

  async #request(method, path, body, { allowedStatusCodes = [], timeoutMs, headers = {} } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs || this.#timeoutMs);

    try {
      const binary = typeof Blob !== 'undefined' && body instanceof Blob;
      const contentType = binary ? body.type : 'application/json';
      const response = await fetch(this.#buildUrl(path), {
        method,
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Accept-Language': document.documentElement.lang || 'en',
          ...headers,
          ...(body === undefined ? {} : { 'Content-Type': contentType }),
        },
        ...(body === undefined ? {} : { body: binary ? body : JSON.stringify(body) }),
        signal: controller.signal,
      });
      const payload = await this.#readPayload(response);

      if (!response.ok && !allowedStatusCodes.includes(response.status)) {
        throw new HttpError(payload?.errorCode || 'REQUEST_FAILED', response.status);
      }

      return payload;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new HttpError('REQUEST_TIMEOUT');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  #buildUrl(path) {
    return new URL(path.replace(/^\//, ''), `${this.#baseUrl}/`).toString();
  }

  async #readPayload(response) {
    const contentType = response.headers.get('content-type') || '';
    return contentType.includes('application/json') ? response.json() : undefined;
  }
}
