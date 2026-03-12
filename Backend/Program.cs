using System.Text.Json;
using Backend.Api;
using Backend.Domain;
using Backend.Infrastructure;
using Backend.Services;

var builder = WebApplication.CreateBuilder(args);

var appOptions = new AppOptions
{
    DataFile = builder.Configuration["DATA_FILE"] ?? Path.Combine(builder.Environment.ContentRootPath, "data/app-data.json"),
    SessionTtlHours = ParseInt(builder.Configuration["SESSION_TTL_HOURS"], 24 * 7),
    IdeaMonthlyLimit = ParseInt(builder.Configuration["IDEA_MONTHLY_LIMIT"], 3),
    CorsOrigin = builder.Configuration["CORS_ORIGIN"] ?? "*"
};

builder.Services.AddSingleton(appOptions);
builder.Services.AddSingleton<FileStateStore>(sp => new FileStateStore(appOptions.DataFile));
builder.Services.AddSingleton<AppService>();
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    options.SerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase;
});
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        if (appOptions.CorsOrigin == "*")
        {
            policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
            return;
        }

        var origins = appOptions.CorsOrigin
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        policy.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod();
    });
});

var app = builder.Build();
var store = app.Services.GetRequiredService<FileStateStore>();
await store.EnsureAsync();

if (args.Any(argument => string.Equals(argument, "seed", StringComparison.OrdinalIgnoreCase)))
{
    var service = app.Services.GetRequiredService<AppService>();
    await service.SeedDemoDataAsync();
    Console.WriteLine($"Seed completed: {appOptions.DataFile}");
    Console.WriteLine("Director: +70000000001 / director123");
    Console.WriteLine("Admin:    +70000000002 / admin123");
    Console.WriteLine("Employee: +70000000003 / employee123");
    Console.WriteLine("Employee: +70000000004 / employee123");
    return;
}

app.UseCors();
app.Use(async (context, next) =>
{
    if (HttpMethods.IsOptions(context.Request.Method))
    {
        context.Response.StatusCode = StatusCodes.Status204NoContent;
        return;
    }

    try
    {
        await next();
    }
    catch (AppException exception)
    {
        context.Response.StatusCode = exception.StatusCode;
        await context.Response.WriteAsJsonAsync(new
        {
            error = new
            {
                code = exception.Code,
                message = exception.Message,
                details = exception.Details
            }
        });
    }
    catch (Exception exception)
    {
        app.Logger.LogError(exception, "Unhandled exception");
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await context.Response.WriteAsJsonAsync(new
        {
            error = new
            {
                code = "INTERNAL_SERVER_ERROR",
                message = "Unexpected server error"
            }
        });
    }
});

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapApiEndpoints();
app.MapFallback(() =>
{
    return Results.Json(new
    {
        error = new
        {
            code = "NOT_FOUND",
            message = "Route was not found"
        }
    }, statusCode: StatusCodes.Status404NotFound);
});

app.Run();

static int ParseInt(string? rawValue, int defaultValue)
{
    return int.TryParse(rawValue, out var parsed) ? parsed : defaultValue;
}
