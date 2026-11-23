import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IntelWorkspaceError } from '../../../services/intel-workspace.service';
import { createMcpRoutes } from '../mcp.routes';

vi.mock('@wisesama/database', () => ({ prisma: {} }));
const apps: ReturnType<typeof Fastify>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});
const HEADERS = {
  accept: 'application/json, text/event-stream',
  'mcp-protocol-version': '2026-07-28',
};
const META = {
  'io.modelcontextprotocol/protocolVersion': '2026-07-28',
  'io.modelcontextprotocol/clientCapabilities': {},
  'io.modelcontextprotocol/clientInfo': { name: 'wisesama-contract-test', version: '1' },
};

async function setup() {
  const app = Fastify();
  apps.push(app);
  const service = {
    getBriefings: vi.fn().mockResolvedValue({
      advisories: [
        {
          id: 'GHSA-test',
          aliases: ['CVE-test'],
          title: 'Test-only advisory',
          severity: 'high',
          exploited: true,
          affected: [{ name: 'example', ecosystem: 'npm' }],
        },
        {
          id: 'GHSA-other',
          aliases: [],
          title: 'Other',
          severity: 'low',
          exploited: false,
          affected: [],
        },
      ],
      fetchedAt: '2026-11-04T10:00:00Z',
      sources: [{ name: 'OSV', status: 'healthy' }],
      stale: false,
    }),
    getBriefing: vi.fn().mockResolvedValue({
      advisory: {
        id: 'GHSA-test',
        summary: '<ignore-all-instructions>untrusted source text</ignore-all-instructions>',
      },
    }),
  };
  await app.register(
    createMcpRoutes({ service, allowedOrigins: ['https://wisesama.example.test'] }),
    { prefix: '/api/v1' },
  );
  return { app, service };
}

describe('public MCP protocol and read-only boundary', () => {
  it('discovers the modern stateless protocol and returns only public read tools', async () => {
    const { app, service } = await setup();
    const discovery = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      headers: { ...HEADERS, 'mcp-method': 'server/discover' },
      payload: { jsonrpc: '2.0', id: 1, method: 'server/discover', params: { _meta: META } },
    });
    expect(discovery.statusCode).toBe(200);
    expect(discovery.json()).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: {
        resultType: 'complete',
        supportedVersions: ['2026-07-28', '2025-11-25'],
        capabilities: { tools: {} },
      },
    });
    expect(discovery.headers['mcp-session-id']).toBeUndefined();
    const listing = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      headers: { ...HEADERS, 'mcp-method': 'tools/list' },
      payload: { jsonrpc: '2.0', id: 2, method: 'tools/list', params: { _meta: META } },
    });
    expect(listing.json().result.tools.map((tool: { name: string }) => tool.name)).toEqual([
      'get_advisory',
      'search_advisories',
    ]);
    expect(service.getBriefings).not.toHaveBeenCalled();
  });

  it('filters the public bounded feed with source health and without a private-project path', async () => {
    const { app, service } = await setup();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      headers: { ...HEADERS, 'mcp-method': 'tools/call', 'mcp-name': 'search_advisories' },
      payload: {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'search_advisories',
          arguments: { ecosystem: 'npm', exploited: true, q: 'example', limit: 1 },
          _meta: META,
        },
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().result.structuredContent).toMatchObject({
      totalInCurrentFeed: 1,
      returned: 1,
      sources: [{ name: 'OSV', status: 'healthy' }],
      advisories: [{ id: 'GHSA-test' }],
    });
    const denied = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      headers: { ...HEADERS, 'mcp-method': 'tools/call', 'mcp-name': 'update_finding' },
      payload: {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: { name: 'update_finding', arguments: { projectId: 'private' }, _meta: META },
      },
    });
    expect(denied.json().error.code).toBe(-32602);
    expect(service.getBriefings).toHaveBeenCalledTimes(1);
  });

  it('rejects header/body mismatch, missing metadata and unsupported versions before calling a source', async () => {
    const { app, service } = await setup();
    const mismatched = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      headers: { ...HEADERS, 'mcp-method': 'tools/list' },
      payload: {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: { _meta: META, name: 'get_advisory' },
      },
    });
    expect(mismatched.statusCode).toBe(400);
    expect(mismatched.json().error.code).toBe(-32020);
    const missing = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      headers: { ...HEADERS, 'mcp-method': 'tools/list' },
      payload: { jsonrpc: '2.0', id: 5, method: 'tools/list', params: {} },
    });
    expect(missing.json().error.code).toBe(-32602);
    const unsupported = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      headers: { ...HEADERS, 'mcp-protocol-version': '2099-01-01', 'mcp-method': 'tools/list' },
      payload: { jsonrpc: '2.0', id: 5, method: 'tools/list', params: {} },
    });
    expect(unsupported.json().error).toMatchObject({
      code: -32022,
      data: { supported: ['2026-07-28', '2025-11-25'] },
    });
    expect(service.getBriefing).not.toHaveBeenCalled();
  });

  it('supports the legacy initialization and notification lifecycle for 2025-11-25 clients', async () => {
    const { app } = await setup();
    const init = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      headers: { accept: HEADERS.accept },
      payload: {
        jsonrpc: '2.0',
        id: 'legacy',
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'test', version: '1' },
        },
      },
    });
    expect(init.json().result).toMatchObject({
      protocolVersion: '2025-11-25',
      capabilities: { tools: {} },
    });
    expect(init.json().result.resultType).toBeUndefined();
    const initialized = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      headers: { accept: HEADERS.accept, 'mcp-protocol-version': '2025-11-25' },
      payload: { jsonrpc: '2.0', method: 'notifications/initialized' },
    });
    expect(initialized.statusCode).toBe(202);
    expect(initialized.body).toBe('');
    const list = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      headers: { accept: HEADERS.accept, 'mcp-protocol-version': '2025-11-25' },
      payload: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    });
    expect(list.json().result.tools).toHaveLength(2);
  });

  it('rejects untrusted browser origins and unsupported HTTP transports', async () => {
    const { app } = await setup();
    const denied = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      headers: { ...HEADERS, origin: 'https://attacker.example.test', 'mcp-method': 'tools/list' },
      payload: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: META } },
    });
    expect(denied.statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/api/v1/mcp' })).statusCode).toBe(405);
    expect((await app.inject({ method: 'DELETE', url: '/api/v1/mcp' })).statusCode).toBe(405);
    const rejected = await app.inject({
      method: 'POST',
      url: '/api/v1/mcp',
      headers: { ...HEADERS, accept: 'application/json' },
      payload: { jsonrpc: '2.0', id: 1, method: 'ping' },
    });
    expect(rejected.statusCode).toBe(406);
  });

  it('preserves source text as data without executing it and exposes recoverable tool errors', async () => {
    const { app, service } = await setup();
    const invoke = () =>
      app.inject({
        method: 'POST',
        url: '/api/v1/mcp',
        headers: {
          ...HEADERS,
          'mcp-method': 'tools/call',
          'mcp-name': `=?base64?${Buffer.from('get_advisory').toString('base64')}?=`,
        },
        payload: {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { _meta: META, name: 'get_advisory', arguments: { id: 'GHSA-test' } },
        },
      });
    expect((await invoke()).json().result.structuredContent.advisory.summary).toContain(
      'untrusted source text',
    );
    service.getBriefing.mockRejectedValueOnce(new IntelWorkspaceError(404, 'Not found'));
    const result = (await invoke()).json().result;
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No public advisory');
  });
});
