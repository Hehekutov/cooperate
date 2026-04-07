namespace Backend.Domain;

public sealed class AppOptions
{
    public string? DatabaseConnectionString { get; init; }

    public string? DataFilePath { get; init; }

    public string DatabaseSchema { get; init; } = "public";

    public int SessionTtlHours { get; init; } = 24 * 7;

    public int IdeaMonthlyLimit { get; init; } = 3;

    public string CorsOrigin { get; init; } = "*";

    public bool UseDatabase => !string.IsNullOrWhiteSpace(DatabaseConnectionString);

    public bool UseFileStore => !string.IsNullOrWhiteSpace(DataFilePath);
}
