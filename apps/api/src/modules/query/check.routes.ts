import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { QueryService } from '../../services/query.service';

const queryService = new QueryService();

export async function checkRoutes(fastify: FastifyInstance) {
  // Single entity lookup
  fastify.get<{ Params: { entity: string } }>('/check/:entity', {
    schema: {
      tags: ['check'],
      description: 'Look up risk assessment for an entity (address, domain, or Twitter handle)',
      params: {
        type: 'object',
        properties: {
          entity: { type: 'string', description: 'Address, domain, or Twitter handle to check' },
        },
        required: ['entity'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            entity: { type: 'string' },
            entityType: { type: 'string', enum: ['ADDRESS', 'DOMAIN', 'TWITTER', 'EMAIL'] },
            chain: { type: 'string' },
            assessment: {
              type: 'object',
              properties: {
                riskLevel: { type: 'string', enum: ['SAFE', 'UNKNOWN', 'CAUTION', 'FRAUD'] },
                riskScore: { type: ['number', 'null'] },
                threatCategory: { type: ['string', 'null'] },
              },
            },
            blacklist: {
              type: 'object',
              properties: {
                found: { type: 'boolean' },
                source: { type: 'string' },
                threatName: { type: 'string' },
              },
            },
            whitelist: {
              type: 'object',
              properties: {
                found: { type: 'boolean' },
                name: { type: 'string' },
                category: { type: 'string' },
              },
            },
            identity: {
              type: 'object',
              properties: {
                hasIdentity: { type: 'boolean' },
                isVerified: { type: 'boolean' },
                displayName: { type: ['string', 'null'] },
                twitter: { type: ['string', 'null'] },
                web: { type: ['string', 'null'] },
                riot: { type: ['string', 'null'] },
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
                timeline: {
                  type: 'object',
                  nullable: true,
                  properties: {
                    identitySetAt: { type: ['string', 'null'], format: 'date-time' },
                    firstVerifiedAt: { type: ['string', 'null'], format: 'date-time' },
                    isMigrated: { type: 'boolean' },
                    source: { type: ['string', 'null'], enum: ['people_chain', 'relay_chain', null] },
                  },
                },
              },
            },
            lookAlike: {
              type: 'object',
              nullable: true,
              properties: {
                isLookAlike: { type: 'boolean' },
                possibleImpersonating: { type: 'string' },
                knownHandle: { type: 'string' },
                similarity: { type: 'number' },
                warning: { type: 'string' },
              },
            },
            mlAnalysis: {
              type: 'object',
              nullable: true,
              properties: {
                available: { type: 'boolean' },
                riskScore: { type: ['number', 'null'] },
                confidence: { type: ['number', 'null'] },
                recommendation: { type: ['string', 'null'], enum: ['safe', 'review', 'high_risk', null] },
                topFeatures: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      importance: { type: 'number' },
                      value: { type: ['string', 'number'] },
                    },
                  },
                },
              },
            },
            transactionSummary: {
              type: 'object',
              nullable: true,
              properties: {
                totalTransactions: { type: 'number' },
                totalReceived: { type: 'string' },
                totalSent: { type: 'string' },
                currentBalance: { type: 'string' },
                lastActivityAt: { type: ['string', 'null'] },
              },
            },
            virusTotal: {
              type: 'object',
              nullable: true,
              properties: {
                verdict: { type: 'string', enum: ['clean', 'malicious', 'suspicious', 'unknown'] },
                positives: { type: 'number' },
                total: { type: 'number' },
                scanUrl: { type: 'string' },
                topEngines: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
            },
            links: {
              type: 'object',
              nullable: true,
              properties: {
                blockExplorer: { type: 'string' },
                virusTotal: { type: 'string' },
              },
            },
            linkedIdentities: {
              type: 'object',
              nullable: true,
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
                      source: { type: 'string', enum: ['POLKADOT_PEOPLE', 'KUSAMA_PEOPLE', 'KILT'] },
                      matchedField: { type: 'string', enum: ['twitter', 'web'] },
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
            stats: {
              type: 'object',
              properties: {
                timesSearched: { type: 'number' },
                userReports: { type: 'number' },
                lastSearched: { type: ['string', 'null'] },
              },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { entity } = request.params;

      try {
        const result = await queryService.checkEntity(entity);
        return result;
      } catch (error) {
        request.log.error(error, 'Failed to check entity');
        reply.status(500);
        return { error: 'Failed to check entity' };
      }
    },
  });

  // Batch lookup
  fastify.post<{ Body: { entities: string[] } }>('/check/batch', {
    schema: {
      tags: ['check'],
      description: 'Batch lookup for multiple entities (max 50)',
      body: {
        type: 'object',
        properties: {
          entities: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 50,
          },
        },
        required: ['entities'],
      },
    },
    handler: async (request, reply) => {
      const schema = z.object({
        entities: z.array(z.string()).max(50),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        reply.status(400);
        return { error: 'Invalid request body', details: parsed.error.issues };
      }

      const results = await Promise.all(
        parsed.data.entities.map(async (entity) => {
          try {
            return await queryService.checkEntity(entity);
          } catch {
            return { entity, error: 'Failed to check entity' };
          }
        })
      );

      const failed = results.filter((r) => 'error' in r).length;

      return {
        results,
        totalProcessed: results.length,
        totalFailed: failed,
      };
    },
  });
}
