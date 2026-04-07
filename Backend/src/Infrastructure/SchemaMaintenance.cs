using Npgsql;

namespace Backend.Infrastructure;

public static class SchemaMaintenance
{
    public static async Task DropSchemaAsync(
        string connectionString,
        string schemaName,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(connectionString);

        var normalizedSchemaName = NormalizeIdentifier(schemaName);
        var quotedSchemaName = QuoteIdentifier(normalizedSchemaName);

        await using var dataSource = new NpgsqlDataSourceBuilder(connectionString).Build();
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(
            $"drop schema if exists {quotedSchemaName} cascade;",
            connection);

        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static string NormalizeIdentifier(string identifier)
    {
        var normalized = (identifier ?? string.Empty).Trim().ToLowerInvariant();

        if (normalized.Length == 0)
        {
            throw new InvalidOperationException("Schema name must not be empty.");
        }

        if (!normalized.All(character => char.IsLetterOrDigit(character) || character == '_'))
        {
            throw new InvalidOperationException("Schema name may only contain latin letters, digits, and underscores.");
        }

        return normalized;
    }

    private static string QuoteIdentifier(string identifier)
    {
        return $"\"{identifier.Replace("\"", "\"\"", StringComparison.Ordinal)}\"";
    }
}
