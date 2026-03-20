using Backend.Domain;

namespace Backend.Infrastructure;

public interface IAppStateStore
{
    Task EnsureAsync(CancellationToken cancellationToken = default);

    Task<AppState> GetStateAsync(CancellationToken cancellationToken = default);

    Task<T> UpdateAsync<T>(Func<AppState, T> mutator, CancellationToken cancellationToken = default);

    Task UpdateAsync(Action<AppState> mutator, CancellationToken cancellationToken = default);

    Task SetStateAsync(AppState state, CancellationToken cancellationToken = default);
}
