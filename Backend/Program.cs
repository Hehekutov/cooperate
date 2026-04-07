using System.Text.Json;
using Backend.Api;
using Backend.Domain;
using Backend.Infrastructure;
using Backend.Services;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);
LoadLocalEnvironmentFiles(builder.Environment.ContentRootPath);

var appOptions = new AppOptions
{
    DatabaseConnectionString =
        Environment.GetEnvironmentVariable("SUPABASE_DB_CONNECTION") ??
        Environment.GetEnvironmentVariable("SUPABASE_DATABASE_URL") ??
        Environment.GetEnvironmentVariable("DATABASE_URL"),
    DataFilePath = ResolveDataFilePath(
        builder.Environment.ContentRootPath,
        Environment.GetEnvironmentVariable("DATA_FILE")),
    DatabaseSchema = Environment.GetEnvironmentVariable("DATABASE_SCHEMA") ?? "public",
    SessionTtlHours = ParseInt(Environment.GetEnvironmentVariable("SESSION_TTL_HOURS"), 24 * 7),
    IdeaMonthlyLimit = ParseInt(Environment.GetEnvironmentVariable("IDEA_MONTHLY_LIMIT"), 3),
    CorsOrigin = Environment.GetEnvironmentVariable("CORS_ORIGIN") ?? "*"
};

builder.Services.AddSingleton(appOptions);

if (await TryHandleMaintenanceCommandAsync(args, appOptions))
{
    return;
}

if (!appOptions.UseDatabase && !appOptions.UseFileStore)
{
    throw new InvalidOperationException(
        "Storage is not configured. Set SUPABASE_DB_CONNECTION or DATABASE_URL for Postgres, " +
        "or set DATA_FILE for a local file-backed test store.");
}

if (appOptions.UseFileStore)
{
    builder.Services.AddSingleton<IAppStateStore>(_ => new JsonFileStateStore(appOptions.DataFilePath!));
}
else if (appOptions.UseDatabase)
{
    builder.Services.AddSingleton(_ =>
    {
        var connectionString = PostgresConnectionStringFactory.Normalize(appOptions.DatabaseConnectionString);
        var dataSourceBuilder = new NpgsqlDataSourceBuilder(connectionString);
        return dataSourceBuilder.Build();
    });
    builder.Services.AddSingleton<IAppStateStore>(serviceProvider => new PostgresStateStore(
        serviceProvider.GetRequiredService<NpgsqlDataSource>(),
        appOptions.DatabaseSchema));
}

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
var store = app.Services.GetRequiredService<IAppStateStore>();
await store.EnsureAsync();

app.Logger.LogInformation(
    "Cooperate backend storage provider: {StorageProvider}",
    appOptions.UseFileStore ? "Local JSON file" : "Supabase/Postgres");

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

static string? ResolveDataFilePath(string contentRootPath, string? rawValue)
{
    if (string.IsNullOrWhiteSpace(rawValue))
    {
        return null;
    }

    return Path.IsPathRooted(rawValue)
        ? rawValue
        : Path.GetFullPath(Path.Combine(contentRootPath, rawValue));
}

static void LoadLocalEnvironmentFiles(string contentRootPath)
{
    foreach (var path in GetLocalEnvironmentFileCandidates(contentRootPath))
    {
        if (!File.Exists(path))
        {
            continue;
        }

        foreach (var rawLine in File.ReadLines(path))
        {
            var line = rawLine.Trim();

            if (line.Length == 0 || line.StartsWith('#'))
            {
                continue;
            }

            var delimiterIndex = line.IndexOf('=');
            if (delimiterIndex <= 0)
            {
                continue;
            }

            var key = line[..delimiterIndex].Trim();
            if (key.Length == 0 || !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(key)))
            {
                continue;
            }

            var value = NormalizeEnvValue(line[(delimiterIndex + 1)..]);
            Environment.SetEnvironmentVariable(key, value);
        }

        return;
    }
}

static IEnumerable<string> GetLocalEnvironmentFileCandidates(string contentRootPath)
{
    yield return Path.Combine(contentRootPath, ".env");
    yield return Path.Combine(contentRootPath, "Backend", ".env");
}

static string NormalizeEnvValue(string rawValue)
{
    var value = rawValue.Trim();

    if (value.Length >= 2 &&
        ((value[0] == '"' && value[^1] == '"') || (value[0] == '\'' && value[^1] == '\'')))
    {
        value = value[1..^1];
    }

    return value
        .Replace("\\n", "\n")
        .Replace("\\r", "\r")
        .Replace("\\t", "\t");
}

static async Task<bool> TryHandleMaintenanceCommandAsync(string[] args, AppOptions appOptions)
{
    if (args.Length == 0)
    {
        return false;
    }

    if (string.Equals(args[0], "drop-schema", StringComparison.OrdinalIgnoreCase))
    {
        if (!appOptions.UseDatabase)
        {
            throw new InvalidOperationException("Database connection string is required for drop-schema.");
        }

        if (args.Length < 2 || string.IsNullOrWhiteSpace(args[1]))
        {
            throw new InvalidOperationException("Usage: dotnet run --project Backend/Backend.csproj -- drop-schema <schema_name>");
        }

        var connectionString = PostgresConnectionStringFactory.Normalize(appOptions.DatabaseConnectionString);
        await SchemaMaintenance.DropSchemaAsync(connectionString, args[1]);
        return true;
    }

    return false;
}
