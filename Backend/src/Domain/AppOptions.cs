namespace Backend.Domain;

public sealed class AppOptions
{
    public string DataFile { get; init; } = Path.Combine(Directory.GetCurrentDirectory(), "data/app-data.json");

    public int SessionTtlHours { get; init; } = 24 * 7;

    public int IdeaMonthlyLimit { get; init; } = 3;

    public string CorsOrigin { get; init; } = "*";
}
