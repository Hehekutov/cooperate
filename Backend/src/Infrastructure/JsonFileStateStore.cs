using System.Text.Json;
using Backend.Domain;

namespace Backend.Infrastructure;

public sealed class JsonFileStateStore : IAppStateStore
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true
    };

    private readonly string _dataFilePath;
    private readonly SemaphoreSlim _gate = new(1, 1);

    public JsonFileStateStore(string dataFilePath)
    {
        _dataFilePath = dataFilePath;
    }

    public async Task EnsureAsync(CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken);

        try
        {
            var directory = Path.GetDirectoryName(_dataFilePath);
            if (!string.IsNullOrWhiteSpace(directory))
            {
                Directory.CreateDirectory(directory);
            }

            if (!File.Exists(_dataFilePath))
            {
                await WriteStateInternalAsync(AppState.CreateInitial(), cancellationToken);
            }
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<AppState> GetStateAsync(CancellationToken cancellationToken = default)
    {
        await EnsureAsync(cancellationToken);
        await _gate.WaitAsync(cancellationToken);

        try
        {
            return await ReadStateInternalAsync(cancellationToken);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<T> UpdateAsync<T>(Func<AppState, T> mutator, CancellationToken cancellationToken = default)
    {
        await EnsureAsync(cancellationToken);
        await _gate.WaitAsync(cancellationToken);

        try
        {
            var state = await ReadStateInternalAsync(cancellationToken);
            var result = mutator(state);
            await WriteStateInternalAsync(state, cancellationToken);
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

    private async Task<AppState> ReadStateInternalAsync(CancellationToken cancellationToken)
    {
        await using var stream = File.Open(_dataFilePath, FileMode.Open, FileAccess.Read, FileShare.Read);
        return await JsonSerializer.DeserializeAsync<AppState>(stream, JsonOptions, cancellationToken)
            ?? AppState.CreateInitial();
    }

    private async Task WriteStateInternalAsync(AppState state, CancellationToken cancellationToken)
    {
        var tempFilePath = $"{_dataFilePath}.tmp";

        await using (var stream = File.Open(tempFilePath, FileMode.Create, FileAccess.Write, FileShare.None))
        {
            await JsonSerializer.SerializeAsync(stream, state, JsonOptions, cancellationToken);
        }

        File.Move(tempFilePath, _dataFilePath, overwrite: true);
    }
}
