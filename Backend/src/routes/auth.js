module.exports = async function authRoutes(app, options) {
  const { service, requireAuth } = options;

  app.post('/api/auth/register-company', {
    schema: {
      body: {
        type: 'object',
        required: ['companyName', 'directorName', 'phone', 'password'],
        additionalProperties: false,
        properties: {
          companyName: { type: 'string', minLength: 1, maxLength: 120 },
          companyDescription: { type: 'string', maxLength: 500 },
          directorName: { type: 'string', minLength: 1, maxLength: 120 },
          directorPosition: { type: 'string', maxLength: 120 },
          phone: { type: 'string', minLength: 10, maxLength: 30 },
          password: { type: 'string', minLength: 6, maxLength: 128 },
          avatarUrl: { type: 'string', maxLength: 500 }
        }
      }
    },
    handler: async (request, reply) => {
      const result = await service.registerCompany(request.body);
      reply.code(201).send({ data: result });
    }
  });

  app.post('/api/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['phone', 'password'],
        additionalProperties: false,
        properties: {
          phone: { type: 'string', minLength: 10, maxLength: 30 },
          password: { type: 'string', minLength: 6, maxLength: 128 }
        }
      }
    },
    handler: async (request, reply) => {
      const result = await service.login(request.body);
      reply.send({ data: result });
    }
  });

  app.get('/api/auth/me', {
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const result = await service.getCompanyOverview(request.currentUser);

      reply.send({
        data: {
          user: request.currentUser,
          company: result.company,
          stats: result.stats
        }
      });
    }
  });

  app.post('/api/auth/logout', {
    preHandler: requireAuth,
    handler: async (request, reply) => {
      await service.logout(request.authToken);
      reply.code(204).send();
    }
  });
};
