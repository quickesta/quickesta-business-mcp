/**
 * Hasura GraphQL client for Quickesta CRM.
 * All queries are scoped by product_id for multi-tenant isolation.
 */

interface HasuraConfig {
  url: string
  adminSecret: string
}

interface QueryOptions {
  query: string
  variables?: Record<string, unknown>
}

export class HasuraClient {
  private config: HasuraConfig

  constructor(config: HasuraConfig) {
    this.config = config
  }

  // MCP SDK internal fields that must never reach Hasura
  private static MCP_INTERNAL_FIELDS = new Set([
    'signal', 'sessionId', 'requestId', 'requestInfo',
    '_meta', '_progressToken', '_cursor',
  ])

  /** Strip MCP SDK internal fields from variables before sending to Hasura */
  private static stripMcpFields(vars?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!vars) return vars
    const cleaned: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(vars)) {
      if (HasuraClient.MCP_INTERNAL_FIELDS.has(key)) continue
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        cleaned[key] = HasuraClient.stripMcpFields(value as Record<string, unknown>)
      } else {
        cleaned[key] = value
      }
    }
    return cleaned
  }

  async query<T = unknown>(options: QueryOptions): Promise<T> {
    const res = await fetch(this.config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'identity',
        'x-hasura-admin-secret': this.config.adminSecret,
      },
      body: JSON.stringify({
        query: options.query,
        variables: HasuraClient.stripMcpFields(options.variables),
      }),
    })

    const text = await res.text()
    let json: { data?: T; errors?: Array<{ message: string }> }
    try {
      json = JSON.parse(text)
    } catch {
      throw new Error(`Invalid response from Hasura (status ${res.status}): ${text.slice(0, 200)}`)
    }

    if (json.errors) {
      throw new Error(json.errors.map((e) => e.message).join(', '))
    }

    return json.data as T
  }
}
