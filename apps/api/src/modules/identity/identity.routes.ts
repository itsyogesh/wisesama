import type { FastifyInstance } from 'fastify';
import { PolkadotService } from '../../services/polkadot.service';
import { ReverseLookupService } from '../../services/reverse-lookup.service';

const polkadotService = new PolkadotService();
const reverseLookupService = new ReverseLookupService();

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
                  github: { type: ['string', 'null'] },
                  discord: { type: ['string', 'null'] },
                  matrix: { type: ['string', 'null'] },
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

  // GitHub reverse lookup — find on-chain addresses linked to a GitHub username
  fastify.get<{ Params: { username: string } }>(
    '/identity/github/:username',
    {
      schema: {
        tags: ['identity'],
        description: 'Find on-chain addresses linked to a GitHub username (via identity additional fields)',
        params: {
          type: 'object',
          properties: {
            username: { type: 'string', description: 'GitHub username' },
          },
          required: ['username'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              found: { type: 'boolean' },
              count: { type: 'number' },
              identities: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    address: { type: 'string' },
                    chain: { type: 'string' },
                    displayName: { type: ['string', 'null'] },
                    isVerified: { type: 'boolean' },
                    source: { type: 'string' },
                    matchedField: { type: 'string' },
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
              hasMore: { type: 'boolean' },
            },
          },
        },
      },
      handler: async (request) => {
        const { username } = request.params;
        return reverseLookupService.findByGithub(username);
      },
    }
  );
}
