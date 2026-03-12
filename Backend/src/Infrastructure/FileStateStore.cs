using System.Text.Json;
using Backend.Domain;

namespace Backend.Infrastructure;

public sealed class FileStateStore
{
    private readonly string _filePath;
    private readonly string _tempFilePath;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true
    };

    public FileStateStore(string filePath)
    {
        _filePath = filePath;
        _tempFilePath = $"{filePath}.tmp";
    }

    public async Task EnsureAsync(CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken);

        try
        {
            await EnsureUnsafeAsync(cancellationToken);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<AppState> GetStateAsync(CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken);

        try
        {
            await EnsureUnsafeAsync(cancellationToken);
            return await ReadStateUnsafeAsync(cancellationToken);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<T> UpdateAsync<T>(Func<AppState, T> mutator, CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken);

        try
        {
            await EnsureUnsafeAsync(cancellationToken);
            var state = await ReadStateUnsafeAsync(cancellationToken);
            var result = mutator(state);
            await WriteStateUnsafeAsync(state, cancellationToken);
            return result;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task UpdateAsync(Action<AppState> mutator, CancellationToken cancellationToken = default)
    {
        await UpdateAsync(state =>
        {
            mutator(state);
            return true;
        }, cancellationToken);
    }

    public async Task SetStateAsync(AppState state, CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken);

        try
        {
            await EnsureUnsafeAsync(cancellationToken);
            await WriteStateUnsafeAsync(state, cancellationToken);
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task EnsureUnsafeAsync(CancellationToken cancellationToken)
    {
        var directory = Path.GetDirectoryName(_filePath);

        if (!string.IsNullOrWhiteSpace(directory))
        {
            Directory.CreateDirectory(directory);
        }

        if (File.Exists(_filePath))
        {
            return;
        }

        await WriteStateUnsafeAsync(AppState.CreateInitial(), cancellationToken);
    }

    private async Task<AppState> ReadStateUnsafeAsync(CancellationToken cancellationToken)
    {
        await using var stream = File.OpenRead(_filePath);
        var state = await JsonSerializer.DeserializeAsync<AppState>(stream, _jsonOptions, cancellationToken);
        return state ?? AppState.CreateInitial();
    }

    private async Task WriteStateUnsafeAsync(AppState state, CancellationToken cancellationToken)
    {
        var payload = JsonSerializer.Serialize(state, _jsonOptions);
        await File.WriteAllTextAsync(_tempFilePath, $"{payload}\n", cancellationToken);
        File.Move(_tempFilePath, _filePath, true);
    }
}
