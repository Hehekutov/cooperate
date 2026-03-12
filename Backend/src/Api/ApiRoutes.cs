using Backend.Domain;
using Backend.Services;

namespace Backend.Api;

public static class ApiRoutes
{
    private const string AuthContextItemKey = "__authContext";

    public static IEndpointRouteBuilder MapApiEndpoints(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api");

        api.MapPost("/auth/register-company", async (HttpContext httpContext, AppService service, CancellationToken cancellationToken) =>
        {
            var request = await RequestValidation.ReadRegisterCompanyAsync(httpContext.Request, cancellationToken);
            var result = await service.RegisterCompanyAsync(request, cancellationToken);
            return Results.Json(new { data = result }, statusCode: StatusCodes.Status201Created);
        });

        api.MapPost("/auth/login", async (HttpContext httpContext, AppService service, CancellationToken cancellationToken) =>
        {
            var request = await RequestValidation.ReadLoginAsync(httpContext.Request, cancellationToken);
            var result = await service.LoginAsync(request, cancellationToken);
            return Results.Json(new { data = result });
        });

        api.MapGet("/auth/me", async (HttpContext httpContext, AppService service, CancellationToken cancellationToken) =>
        {
            var context = await RequireAuthAsync(httpContext, service, cancellationToken);
            var result = await service.GetCompanyOverviewAsync(context.User, cancellationToken);
            return Results.Json(new
            {
                data = new
                {
                    user = context.User,
                    company = result.Company,
                    stats = result.Stats
                }
            });
        });

        api.MapPost("/auth/logout", async (HttpContext httpContext, AppService service, CancellationToken cancellationToken) =>
        {
            var context = await RequireAuthAsync(httpContext, service, cancellationToken);
            await service.LogoutAsync(context.Token, cancellationToken);
            return Results.NoContent();
        });

        api.MapGet("/company", async (HttpContext httpContext, AppService service, CancellationToken cancellationToken) =>
        {
            var context = await RequireAuthAsync(httpContext, service, cancellationToken);
            var result = await service.GetCompanyOverviewAsync(context.User, cancellationToken);
            return Results.Json(new { data = result });
        });

        api.MapGet("/employees", async (HttpContext httpContext, AppService service, CancellationToken cancellationToken) =>
        {
            var context = await RequireAuthAsync(httpContext, service, cancellationToken);
            var result = await service.ListEmployeesAsync(context.User, cancellationToken);
            return Results.Json(new { data = result });
        });

        api.MapPost("/employees", async (HttpContext httpContext, AppService service, CancellationToken cancellationToken) =>
        {
            var context = await RequireRoleAsync(httpContext, service, [Roles.Director], cancellationToken);
            var request = await RequestValidation.ReadCreateEmployeeAsync(httpContext.Request, cancellationToken);
            var result = await service.AddEmployeeAsync(context.User, request, cancellationToken);
            return Results.Json(new { data = result }, statusCode: StatusCodes.Status201Created);
        });

        api.MapGet("/ideas", async (HttpContext httpContext, AppService service, CancellationToken cancellationToken) =>
        {
            var context = await RequireAuthAsync(httpContext, service, cancellationToken);
            var query = RequestValidation.ReadIdeaListQuery(httpContext.Request.Query);
            var result = await service.ListIdeasAsync(context.User, query, cancellationToken);
            return Results.Json(new { data = result });
        });

        api.MapGet("/ideas/{ideaId}", async (HttpContext httpContext, string ideaId, AppService service, CancellationToken cancellationToken) =>
        {
            var context = await RequireAuthAsync(httpContext, service, cancellationToken);
            var result = await service.GetIdeaAsync(context.User, ideaId, cancellationToken);
            return Results.Json(new { data = result });
        });

        api.MapPost("/ideas", async (HttpContext httpContext, AppService service, CancellationToken cancellationToken) =>
        {
            var context = await RequireAuthAsync(httpContext, service, cancellationToken);
            var request = await RequestValidation.ReadCreateIdeaAsync(httpContext.Request, cancellationToken);
            var result = await service.CreateIdeaAsync(context.User, request, cancellationToken);
            return Results.Json(new { data = result }, statusCode: StatusCodes.Status201Created);
        });

        api.MapPost("/ideas/{ideaId}/moderate", async (HttpContext httpContext, string ideaId, AppService service, CancellationToken cancellationToken) =>
        {
            var context = await RequireRoleAsync(httpContext, service, [Roles.Admin, Roles.Director], cancellationToken);
            var request = await RequestValidation.ReadModerateIdeaAsync(httpContext.Request, cancellationToken);
            var result = await service.ModerateIdeaAsync(context.User, ideaId, request, cancellationToken);
            return Results.Json(new { data = result });
        });

        api.MapPost("/ideas/{ideaId}/vote", async (HttpContext httpContext, string ideaId, AppService service, CancellationToken cancellationToken) =>
        {
            var context = await RequireAuthAsync(httpContext, service, cancellationToken);
            var request = await RequestValidation.ReadVoteIdeaAsync(httpContext.Request, cancellationToken);
            var result = await service.VoteIdeaAsync(context.User, ideaId, request, cancellationToken);
            return Results.Json(new { data = result });
        });

        api.MapPost("/ideas/{ideaId}/decision", async (HttpContext httpContext, string ideaId, AppService service, CancellationToken cancellationToken) =>
        {
            var context = await RequireRoleAsync(httpContext, service, [Roles.Director], cancellationToken);
            var request = await RequestValidation.ReadDirectorDecisionAsync(httpContext.Request, cancellationToken);
            var result = await service.MakeDirectorDecisionAsync(context.User, ideaId, request, cancellationToken);
            return Results.Json(new { data = result });
        });

        return app;
    }

    private static async Task<RequestAuthContext> RequireAuthAsync(HttpContext httpContext, AppService service, CancellationToken cancellationToken)
    {
        if (httpContext.Items.TryGetValue(AuthContextItemKey, out var cached) && cached is RequestAuthContext context)
        {
            return context;
        }

        var header = httpContext.Request.Headers.Authorization.ToString();
        var token = GetBearerToken(header);

        if (string.IsNullOrWhiteSpace(token))
        {
            throw new AppException(StatusCodes.Status401Unauthorized, "UNAUTHORIZED", "Authentication is required");
        }

        var authContext = await service.GetContextByTokenAsync(token, cancellationToken);

        if (authContext is null)
        {
            throw new AppException(StatusCodes.Status401Unauthorized, "UNAUTHORIZED", "Invalid or expired token");
        }

        httpContext.Items[AuthContextItemKey] = authContext;
        return authContext;
    }

    private static async Task<RequestAuthContext> RequireRoleAsync(HttpContext httpContext, AppService service, string[] roles, CancellationToken cancellationToken)
    {
        var context = await RequireAuthAsync(httpContext, service, cancellationToken);

        if (!roles.Contains(context.User.Role, StringComparer.Ordinal))
        {
            throw new AppException(StatusCodes.Status403Forbidden, "FORBIDDEN", $"This endpoint is only available for roles: {string.Join(", ", roles)}");
        }

        return context;
    }

    private static string? GetBearerToken(string? authorizationHeader)
    {
        if (string.IsNullOrWhiteSpace(authorizationHeader))
        {
            return null;
        }

        var parts = authorizationHeader.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        if (parts.Length != 2 || !string.Equals(parts[0], "Bearer", StringComparison.Ordinal))
        {
            return null;
        }

        return parts[1];
    }
}
