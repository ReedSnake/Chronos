export class HttpError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}

export class HttpClient {
  #baseUrl;

  #timeoutMs;

  constructor({ baseUrl, timeoutMs }) {
    this.#baseUrl = baseUrl;
    this.#timeoutMs = timeoutMs;
  }

  async get(path, { allowedStatusCodes = [], timeoutMs } = {}) {
    return this.#request('GET', path, undefined, { allowedStatusCodes, timeoutMs });
  }

  async post(path, body, { timeoutMs } = {}) {
    return this.#request('POST', path, body, { timeoutMs });
  }

  async patch(path, body) {
    return this.#request('PATCH', path, body);
  }

  async put(path, body) {
    return this.#request('PUT', path, body);
  }

  async putImage(path, file) {
    return this.#request('PUT', path, file, { timeoutMs: 30000 });
  }

  async delete(path) {
    return this.#request('DELETE', path);
  }

  async #request(method, path, body, { allowedStatusCodes = [], timeoutMs } = {}) {
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
          ...(body === undefined ? {} : { 'Content-Type': contentType }),
        },
        ...(body === undefined ? {} : { body: binary ? body : JSON.stringify(body) }),
        signal: controller.signal,
      });
      const payload = await this.#readPayload(response);

      if (!response.ok && !allowedStatusCodes.includes(response.status)) {
        throw new HttpError(payload?.error || `Request failed with status ${response.status}`, response.status);
      }

      return payload;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new HttpError('Request timed out');
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
