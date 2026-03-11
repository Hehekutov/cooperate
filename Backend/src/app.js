const fastify = require('fastify');

const { AppService } = require('./lib/app-service');
const { AppError, unauthorized, forbidden } = require('./lib/errors');
const authRoutes = require('./routes/auth');
const companyRoutes = require('./routes/company');
const employeeRoutes = require('./routes/employees');
const ideaRoutes = require('./routes/ideas');

function getBearerToken(authorizationHeader) {
  const raw = String(authorizationHeader ?? '');
  const [scheme, token] = raw.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token.trim();
}

async function createApp(options = {}) {
  const service = options.service ?? new AppService(options);
  await service.initialize();

  const app = fastify({
    logger: options.logger ?? true
  });

  const corsOrigin = options.corsOrigin ?? process.env.CORS_ORIGIN ?? '*';

  app.decorate('service', service);
  app.decorateRequest('authToken', null);
  app.decorateRequest('currentUser', null);
  app.decorateRequest('currentCompany', null);

  app.addHook('onRequest', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', corsOrigin);
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    reply.header(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    );

    if (request.method === 'OPTIONS') {
      reply.code(204).send();
    }
  });

  async function requireAuth(request) {
    if (request.currentUser) {
      return request.currentUser;
    }

    const token = getBearerToken(request.headers.authorization);

    if (!token) {
      throw unauthorized();
    }

    const context = await service.getContextByToken(token);

    if (!context) {
      throw unauthorized('Invalid or expired token');
    }

    request.authToken = token;
    request.currentUser = context.user;
    request.currentCompany = context.company;

    return request.currentUser;
  }

  function requireRoles(...roles) {
    return async function roleGuard(request) {
      await requireAuth(request);

      if (!roles.includes(request.currentUser.role)) {
        throw forbidden(`This endpoint is only available for roles: ${roles.join(', ')}`);
      }
    };
  }

  app.get('/health', async () => {
    return {
      status: 'ok'
    };
  });

  app.setErrorHandler(async (error, _request, reply) => {
    if (error instanceof AppError) {
      reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? null
        }
      });
      return;
    }

    if (error.validation) {
      reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          details: error.validation
        }
      });
      return;
    }

    app.log.error(error);

    reply.code(500).send({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Unexpected server error'
      }
    });
  });

  await app.register(authRoutes, { service, requireAuth });
  await app.register(companyRoutes, { service, requireAuth });
  await app.register(employeeRoutes, { service, requireAuth, requireRoles });
  await app.register(ideaRoutes, { service, requireAuth, requireRoles });

  app.setNotFoundHandler(async (_request, reply) => {
    reply.code(404).send({
      error: {
        code: 'NOT_FOUND',
        message: 'Route was not found'
      }
    });
  });

  await app.ready();

  return app;
}

module.exports = {
  createApp
};
