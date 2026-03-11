module.exports = async function companyRoutes(app, options) {
  const { service, requireAuth } = options;

  app.get('/api/company', {
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const result = await service.getCompanyOverview(request.currentUser);
      reply.send({ data: result });
    }
  });
};
