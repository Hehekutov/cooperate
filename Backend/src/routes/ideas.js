const { IDEA_STATUSES, ROLES } = require('../lib/constants');

module.exports = async function ideaRoutes(app, options) {
  const { service, requireAuth, requireRoles } = options;

  app.get('/api/ideas', {
    preHandler: requireAuth,
    schema: {
      querystring: {
        type: 'object',
        additionalProperties: false,
        properties: {
          scope: {
            type: 'string',
            enum: ['active', 'archive', 'mine', 'moderation', 'director_review', 'all']
          },
          status: {
            type: 'string',
            enum: Object.values(IDEA_STATUSES)
          },
          q: { type: 'string', maxLength: 120 },
          limit: { type: 'integer', minimum: 1, maximum: 100 },
          sort: { type: 'string', enum: ['recent', 'support'] }
        }
      }
    },
    handler: async (request, reply) => {
      const result = await service.listIdeas(request.currentUser, request.query);
      reply.send({ data: result });
    }
  });

  app.get('/api/ideas/:ideaId', {
    preHandler: requireAuth,
    schema: {
      params: {
        type: 'object',
        required: ['ideaId'],
        properties: {
          ideaId: { type: 'string', minLength: 1 }
        }
      }
    },
    handler: async (request, reply) => {
      const result = await service.getIdea(request.currentUser, request.params.ideaId);
      reply.send({ data: result });
    }
  });

  app.post('/api/ideas', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        required: ['title', 'description'],
        additionalProperties: false,
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 160 },
          description: { type: 'string', minLength: 1, maxLength: 3000 }
        }
      }
    },
    handler: async (request, reply) => {
      const result = await service.createIdea(request.currentUser, request.body);
      reply.code(201).send({ data: result });
    }
  });

  app.post('/api/ideas/:ideaId/moderate', {
    preHandler: requireRoles(ROLES.ADMIN, ROLES.DIRECTOR),
    schema: {
      params: {
        type: 'object',
        required: ['ideaId'],
        properties: {
          ideaId: { type: 'string', minLength: 1 }
        }
      },
      body: {
        type: 'object',
        required: ['approved'],
        additionalProperties: false,
        properties: {
          approved: { type: 'boolean' },
          comment: { type: 'string', maxLength: 1000 }
        }
      }
    },
    handler: async (request, reply) => {
      const result = await service.moderateIdea(
        request.currentUser,
        request.params.ideaId,
        request.body
      );

      reply.send({ data: result });
    }
  });

  app.post('/api/ideas/:ideaId/vote', {
    preHandler: requireAuth,
    schema: {
      params: {
        type: 'object',
        required: ['ideaId'],
        properties: {
          ideaId: { type: 'string', minLength: 1 }
        }
      },
      body: {
        type: 'object',
        required: ['value'],
        additionalProperties: false,
        properties: {
          value: { type: 'string', enum: ['for', 'against'] }
        }
      }
    },
    handler: async (request, reply) => {
      const result = await service.voteIdea(
        request.currentUser,
        request.params.ideaId,
        request.body
      );

      reply.send({ data: result });
    }
  });

  app.post('/api/ideas/:ideaId/decision', {
    preHandler: requireRoles(ROLES.DIRECTOR),
    schema: {
      params: {
        type: 'object',
        required: ['ideaId'],
        properties: {
          ideaId: { type: 'string', minLength: 1 }
        }
      },
      body: {
        type: 'object',
        required: ['approved'],
        additionalProperties: false,
        properties: {
          approved: { type: 'boolean' },
          comment: { type: 'string', maxLength: 1000 }
        }
      }
    },
    handler: async (request, reply) => {
      const result = await service.makeDirectorDecision(
        request.currentUser,
        request.params.ideaId,
        request.body
      );

      reply.send({ data: result });
    }
  });
};
