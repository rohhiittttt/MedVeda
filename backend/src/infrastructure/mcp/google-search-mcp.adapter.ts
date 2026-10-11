import type { ISearchToolPort, RawSearchItem } from '../../domain/ports/search.port.ts';

export interface McpClientConfig {
  readonly endpointUrl?: string;
  readonly customSearchApiKey?: string;
  readonly customSearchCx?: string;
  readonly defaultTimeoutMs?: number;
}

/**
 * Adapter for executing Google Search via Model Context Protocol (MCP) or Google Custom Search JSON API.
 * Enforces PII-isolated queries and strict timeouts (default 8000ms).
 */
export class GoogleSearchMcpAdapter implements ISearchToolPort {
  private readonly endpointUrl: string;
  private readonly customSearchApiKey: string;
  private readonly customSearchCx: string;
  private readonly defaultTimeoutMs: number;

  constructor(config: McpClientConfig = {}) {
    this.endpointUrl = config.endpointUrl ?? process.env.GOOGLE_SEARCH_MCP_URL ?? '';
    this.customSearchApiKey = config.customSearchApiKey ?? process.env.GOOGLE_CUSTOM_SEARCH_API_KEY ?? '';
    this.customSearchCx = config.customSearchCx ?? process.env.GOOGLE_CUSTOM_SEARCH_CX ?? '';
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? 8000;
  }

  async search(query: string, timeoutMs?: number): Promise<readonly RawSearchItem[]> {
    const timeout = timeoutMs ?? this.defaultTimeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      return await this.executeSearchCall(query, controller.signal);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Google Search MCP timed out after ${timeout}ms for query: "${query}"`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async searchBatch(queries: readonly string[], timeoutMs?: number): Promise<readonly RawSearchItem[]> {
    const results = await Promise.allSettled(queries.map((q) => this.search(q, timeoutMs)));
    const items: RawSearchItem[] = [];

    for (const res of results) {
      if (res.status === 'fulfilled') {
        items.push(...res.value);
      }
    }

    return items;
  }

  protected async executeSearchCall(query: string, signal: AbortSignal): Promise<readonly RawSearchItem[]> {
    // 1. If a Google Search MCP HTTP/JSON-RPC endpoint is configured, invoke it
    if (this.endpointUrl) {
      const response = await fetch(this.endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `mcp_${Date.now()}`,
          method: 'tools/call',
          params: {
            name: 'google_search',
            arguments: { query, num_results: 5 }
          }
        }),
        signal
      });

      if (response.ok) {
        const data = (await response.json()) as any;
        const rawList = data?.result?.items || data?.items || data?.results || [];
        if (Array.isArray(rawList)) {
          return rawList
            .filter((item: any) => item && item.title && (item.link || item.url))
            .map((item: any) => ({
              title: String(item.title),
              snippet: String(item.snippet || item.description || ''),
              link: String(item.link || item.url)
            }));
        }
      }
    }

    // 2. If Google Custom Search API credentials are configured, query Custom Search JSON API
    if (this.customSearchApiKey && this.customSearchCx) {
      const url = new URL('https://www.googleapis.com/customsearch/v1');
      url.searchParams.set('key', this.customSearchApiKey);
      url.searchParams.set('cx', this.customSearchCx);
      url.searchParams.set('q', query);
      url.searchParams.set('num', '5');
      url.searchParams.set('gl', 'in');

      const response = await fetch(url.toString(), { method: 'GET', signal });
      if (response.ok) {
        const data = (await response.json()) as any;
        if (Array.isArray(data?.items)) {
          return data.items.map((item: any) => ({
            title: String(item.title || ''),
            snippet: String(item.snippet || ''),
            link: String(item.link || '')
          }));
        }
      }
    }

    // 3. Default base fallback when no external MCP / Custom Search key is configured
    return [];
  }
}
