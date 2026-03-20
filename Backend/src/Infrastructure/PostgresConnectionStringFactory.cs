using System.Globalization;
using Npgsql;

namespace Backend.Infrastructure;

public static class PostgresConnectionStringFactory
{
    public static string Normalize(string? rawConnectionString)
    {
        if (string.IsNullOrWhiteSpace(rawConnectionString))
        {
            throw new InvalidOperationException("Supabase database connection string was not provided");
        }

        var connectionString = rawConnectionString.Trim();

        if (LooksLikeKeywordConnectionString(connectionString))
        {
            var builder = new NpgsqlConnectionStringBuilder(connectionString);
            EnsureSecureDefaults(builder, connectionString);
            EnsureApplicationName(builder);
            return builder.ConnectionString;
        }

        if (!Uri.TryCreate(connectionString, UriKind.Absolute, out var uri) ||
            uri.Scheme is not ("postgres" or "postgresql"))
        {
            throw new InvalidOperationException("Unsupported Postgres connection string format");
        }

        var uriBuilder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.IsDefaultPort || uri.Port <= 0 ? 5432 : uri.Port,
            Database = string.IsNullOrWhiteSpace(uri.AbsolutePath.Trim('/'))
                ? "postgres"
                : Uri.UnescapeDataString(uri.AbsolutePath.Trim('/'))
        };

        ApplyUserInfo(uriBuilder, uri.UserInfo);

        foreach (var part in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var keyValue = part.Split('=', 2);
            var key = Uri.UnescapeDataString(keyValue[0]);
            var value = keyValue.Length == 2 ? Uri.UnescapeDataString(keyValue[1]) : string.Empty;
            ApplyQuerySetting(uriBuilder, key, value);
        }

        EnsureSecureDefaults(uriBuilder, connectionString);
        EnsureApplicationName(uriBuilder);
        return uriBuilder.ConnectionString;
    }

    private static bool LooksLikeKeywordConnectionString(string value)
    {
        return value.Contains('=') &&
            (value.Contains(';') ||
                value.StartsWith("Host=", StringComparison.OrdinalIgnoreCase) ||
                value.StartsWith("Server=", StringComparison.OrdinalIgnoreCase));
    }

    private static void ApplyUserInfo(NpgsqlConnectionStringBuilder builder, string userInfo)
    {
        if (string.IsNullOrWhiteSpace(userInfo))
        {
            return;
        }

        var parts = userInfo.Split(':', 2);

        if (!string.IsNullOrWhiteSpace(parts[0]))
        {
            builder.Username = Uri.UnescapeDataString(parts[0]);
        }

        if (parts.Length == 2)
        {
            builder.Password = Uri.UnescapeDataString(parts[1]);
        }
    }

    private static void ApplyQuerySetting(NpgsqlConnectionStringBuilder builder, string key, string value)
    {
        var normalizedKey = key
            .Replace("_", string.Empty, StringComparison.Ordinal)
            .Replace("-", string.Empty, StringComparison.Ordinal)
            .Replace(" ", string.Empty, StringComparison.Ordinal)
            .ToLowerInvariant();

        switch (normalizedKey)
        {
            case "sslmode":
                if (TryParseSslMode(value, out var sslMode))
                {
                    builder.SslMode = sslMode;
                }
                break;
            case "pooling":
                if (bool.TryParse(value, out var pooling))
                {
                    builder.Pooling = pooling;
                }
                break;
            case "timeout":
                if (int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var timeout))
                {
                    builder.Timeout = timeout;
                }
                break;
            case "commandtimeout":
                if (int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var commandTimeout))
                {
                    builder.CommandTimeout = commandTimeout;
                }
                break;
            case "keepalive":
                if (int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var keepAlive))
                {
                    builder.KeepAlive = keepAlive;
                }
                break;
            case "searchpath":
                builder.SearchPath = value;
                break;
            case "applicationname":
                builder.ApplicationName = value;
                break;
        }
    }

    private static bool TryParseSslMode(string value, out SslMode sslMode)
    {
        switch (value.Trim().ToLowerInvariant())
        {
            case "disable":
                sslMode = SslMode.Disable;
                return true;
            case "allow":
                sslMode = SslMode.Allow;
                return true;
            case "prefer":
                sslMode = SslMode.Prefer;
                return true;
            case "require":
                sslMode = SslMode.Require;
                return true;
            case "verifyca":
                sslMode = SslMode.VerifyCA;
                return true;
            case "verifyfull":
                sslMode = SslMode.VerifyFull;
                return true;
            default:
                sslMode = default;
                return false;
        }
    }

    private static void EnsureApplicationName(NpgsqlConnectionStringBuilder builder)
    {
        if (string.IsNullOrWhiteSpace(builder.ApplicationName))
        {
            builder.ApplicationName = "cooperate-backend";
        }
    }

    private static void EnsureSecureDefaults(NpgsqlConnectionStringBuilder builder, string rawConnectionString)
    {
        if (ContainsSslModeSetting(rawConnectionString) || IsLocalHost(builder.Host))
        {
            return;
        }

        builder.SslMode = SslMode.Require;
    }

    private static bool ContainsSslModeSetting(string connectionString)
    {
        return connectionString.Contains("sslmode=", StringComparison.OrdinalIgnoreCase) ||
            connectionString.Contains("ssl mode=", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsLocalHost(string? host)
    {
        if (string.IsNullOrWhiteSpace(host))
        {
            return true;
        }

        return host.Equals("localhost", StringComparison.OrdinalIgnoreCase) ||
            host.Equals("127.0.0.1", StringComparison.OrdinalIgnoreCase) ||
            host.Equals("::1", StringComparison.OrdinalIgnoreCase);
    }
}
