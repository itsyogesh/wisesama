import { parseInventory } from '../../../../../api/src/services/intel/inventory';
import { InventoryValidationError } from '../../../../../api/src/services/intel/types';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return Response.json({ error: 'Choose a supported inventory file.' }, { status: 415 });
  }
  const maxRequestBytes = 4 * 1024 * 1024;
  if (Number(request.headers.get('content-length')) > maxRequestBytes) {
    return Response.json({ error: 'This inventory exceeds the 2 MB limit.' }, { status: 413 });
  }
  try {
    const reader = request.body?.getReader();
    if (!reader)
      return Response.json({ error: 'Choose a non-empty inventory file.' }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxRequestBytes) {
        await reader.cancel();
        return Response.json({ error: 'This inventory exceeds the 2 MB limit.' }, { status: 413 });
      }
      chunks.push(value);
    }
    const raw = Buffer.concat(chunks).toString('utf8');
    const body: unknown = JSON.parse(raw);
    if (
      !body ||
      typeof body !== 'object' ||
      !('content' in body) ||
      typeof body.content !== 'string'
    ) {
      return Response.json({ error: 'Choose a non-empty inventory file.' }, { status: 400 });
    }
    const result = parseInventory(body.content);
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof InventoryValidationError
            ? error.message
            : 'This file could not be read. Upload valid JSON or a pnpm lockfile.',
      },
      { status: 400, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}
