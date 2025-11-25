import type { FastifyInstance } from 'fastify';
import { PolkadotService } from '../../services/polkadot.service';

const polkadotService = new PolkadotService();

export async function identityRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { address: string }; Querystring: { chain?: string } }>(
    '/identity/:address',
    {
      schema: {
        tags: ['identity'],
        description: 'Look up Polkadot on-chain identity for an address',
        params: {
          type: 'object',
          properties: {
            address: { type: 'string', description: 'Polkadot/Kusama address' },
          },
          required: ['address'],
        },
        querystring: {
          type: 'object',
          properties: {
            chain: {
              type: 'string',
              enum: ['polkadot', 'kusama'],
              default: 'polkadot',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              address: { type: 'string' },
              chain: { type: 'string' },
              hasIdentity: { type: 'boolean' },
              isVerified: { type: 'boolean' },
              identity: {
                type: ['object', 'null'],
                properties: {
                  displayName: { type: ['string', 'null'] },
                  legalName: { type: ['string', 'null'] },
                  email: { type: ['string', 'null'] },
                  twitter: { type: ['string', 'null'] },
                  web: { type: ['string', 'null'] },
                  riot: { type: ['string', 'null'] },
                },
              },
              judgements: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    registrarId: { type: 'number' },
                    judgement: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
      handler: async (request, reply) => {
        const { address } = request.params;
        const chain = request.query.chain || 'polkadot';

        try {
          const identity = await polkadotService.getIdentity(address, chain);
          return identity;
        } catch (error) {
          request.log.error(error, 'Failed to fetch identity');
          reply.status(500);
          return { error: 'Failed to fetch identity' };
        }
      },
    }
  );
}
