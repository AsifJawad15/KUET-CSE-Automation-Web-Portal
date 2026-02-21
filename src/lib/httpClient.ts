// ==========================================
// HTTP Client Abstraction
// Dependency Inversion: Services depend on this abstraction, not raw fetch()
// Single Responsibility: Only handles HTTP communication
// Open/Closed: Easily extendable for interceptors, auth headers, etc.
// ==========================================

/**
 * Standard shape returned by all service HTTP calls.
 */
export interface ServiceResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: Record<string, unknown>;
}

/**
 * Options for HTTP requests.
 */
interface RequestOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

const DEFAULT_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
};

/**
 * Centralized HTTP client for service-layer calls.
 * All network errors are caught and returned as `{ success: false, error }`.
 */
class HttpClient {
  private baseUrl: string;

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
  }

  // ── Core Methods ───────────────────────────

  async get<T>(path: string, params?: Record<string, string>, options?: RequestOptions): Promise<ServiceResult<T>> {
    try {
      const url = this.buildUrl(path, params);
      const response = await fetch(url, {
        method: 'GET',
        headers: { ...DEFAULT_HEADERS, ...options?.headers },
        signal: options?.signal,
      });
      return this.handleResponse<T>(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getList<T>(path: string, params?: Record<string, string>, options?: RequestOptions): Promise<T[]> {
    try {
      const url = this.buildUrl(path, params);
      const response = await fetch(url, {
        method: 'GET',
        headers: { ...DEFAULT_HEADERS, ...options?.headers },
        signal: options?.signal,
      });
      if (!response.ok) return [];
      return await response.json() ?? [];
    } catch {
      return [];
    }
  }

  async post<T>(path: string, body: unknown, options?: RequestOptions): Promise<ServiceResult<T>> {
    try {
      const response = await fetch(this.buildUrl(path), {
        method: 'POST',
        headers: { ...DEFAULT_HEADERS, ...options?.headers },
        body: JSON.stringify(body),
        signal: options?.signal,
      });
      return this.handleResponse<T>(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async patch<T>(path: string, body: unknown, options?: RequestOptions): Promise<ServiceResult<T>> {
    try {
      const response = await fetch(this.buildUrl(path), {
        method: 'PATCH',
        headers: { ...DEFAULT_HEADERS, ...options?.headers },
        body: JSON.stringify(body),
        signal: options?.signal,
      });
      return this.handleResponse<T>(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async delete(path: string, params?: Record<string, string>, options?: RequestOptions): Promise<ServiceResult<void>> {
    try {
      const url = this.buildUrl(path, params);
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { ...DEFAULT_HEADERS, ...options?.headers },
        signal: options?.signal,
      });
      return this.handleResponse<void>(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  // ── Helpers ────────────────────────────────

  private buildUrl(path: string, params?: Record<string, string>): string {
    const url = `${this.baseUrl}${path}`;
    if (!params || Object.keys(params).length === 0) return url;

    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, value);
      }
    }
    const qs = searchParams.toString();
    return qs ? `${url}?${qs}` : url;
  }

  private async handleResponse<T>(response: Response): Promise<ServiceResult<T>> {
    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        error: json.error || json.message || `Request failed with status ${response.status}`,
      };
    }

    // Normalize: if response has { success, data }, use it; otherwise wrap raw data
    if (typeof json === 'object' && 'success' in json) {
      return json as ServiceResult<T>;
    }

    return { success: true, data: json as T };
  }

  private handleError(error: unknown): ServiceResult<never> {
    const message = error instanceof Error ? error.message : 'Network error';
    console.error('[HttpClient]', message);
    return { success: false, error: message };
  }
}

// ── Singleton Export ──────────────────────────

/**
 * Pre-configured HTTP client for internal API calls.
 * All services should use this instead of raw `fetch()`.
 */
export const apiClient = new HttpClient('/api');
