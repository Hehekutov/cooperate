const { ROLES } = require('../lib/constants');

module.exports = async function employeeRoutes(app, options) {
  const { service, requireAuth, requireRoles } = options;

  app.get('/api/employees', {
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const result = await service.listEmployees(request.currentUser);
      reply.send({ data: result });
    }
  });

  app.post('/api/employees', {
    preHandler: requireRoles(ROLES.DIRECTOR),
    schema: {
      body: {
        type: 'object',
        required: ['fullName', 'phone', 'password', 'role'],
        additionalProperties: false,
        properties: {
          fullName: { type: 'string', minLength: 1, maxLength: 120 },
          phone: { type: 'string', minLength: 10, maxLength: 30 },
          password: { type: 'string', minLength: 6, maxLength: 128 },
          role: { type: 'string', enum: [ROLES.ADMIN, ROLES.EMPLOYEE] },
          position: { type: 'string', maxLength: 120 },
          avatarUrl: { type: 'string', maxLength: 500 }
        }
      }
    },
    handler: async (request, reply) => {
      const result = await service.addEmployee(request.currentUser, request.body);
      reply.code(201).send({ data: result });
    }
  });
};
