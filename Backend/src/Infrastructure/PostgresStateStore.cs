using Backend.Domain;
using Npgsql;

namespace Backend.Infrastructure;

public sealed class PostgresStateStore : IAppStateStore
{
    private readonly NpgsqlDataSource _dataSource;
    private readonly string _schemaName;
    private readonly string _quotedSchemaName;
    private readonly string _companiesTable;
    private readonly string _usersTable;
    private readonly string _ideasTable;
    private readonly string _ideaEligibilityTable;
    private readonly string _votesTable;
    private readonly string _sessionsTable;
    private readonly SemaphoreSlim _ensureSemaphore = new(1, 1);
    private bool _storageEnsured;

    public PostgresStateStore(
        NpgsqlDataSource dataSource,
        string schemaName)
    {
        _dataSource = dataSource;
        _schemaName = NormalizeIdentifier(schemaName, "schema");
        _quotedSchemaName = QuoteIdentifier(_schemaName);
        _companiesTable = Qualified("companies");
        _usersTable = Qualified("user_accounts");
        _ideasTable = Qualified("ideas");
        _ideaEligibilityTable = Qualified("idea_voting_eligible_users");
        _votesTable = Qualified("idea_votes");
        _sessionsTable = Qualified("app_sessions");
    }

    public async Task EnsureAsync(CancellationToken cancellationToken = default)
    {
        if (_storageEnsured)
        {
            return;
        }

        await _ensureSemaphore.WaitAsync(cancellationToken);

        try
        {
            if (_storageEnsured)
            {
                return;
            }

            await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken);
            await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
            await AcquireStateLockAsync(connection, transaction, cancellationToken);
            await EnsureStorageAsync(connection, transaction, cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            _storageEnsured = true;
        }
        finally
        {
            _ensureSemaphore.Release();
        }
    }

    public async Task<AppState> GetStateAsync(CancellationToken cancellationToken = default)
    {
        await EnsureAsync(cancellationToken);

        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        await AcquireStateLockAsync(connection, transaction, cancellationToken);
        var state = await ReadStateAsync(connection, transaction, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return state;
    }

    public async Task<T> UpdateAsync<T>(Func<AppState, T> mutator, CancellationToken cancellationToken = default)
    {
        await EnsureAsync(cancellationToken);

        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        await AcquireStateLockAsync(connection, transaction, cancellationToken);
        var state = await ReadStateAsync(connection, transaction, cancellationToken);
        var result = mutator(state);

        await WriteStateAsync(connection, transaction, state, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return result;
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
        await EnsureAsync(cancellationToken);

        await using var connection = await _dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        await AcquireStateLockAsync(connection, transaction, cancellationToken);
        await WriteStateAsync(connection, transaction, state, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    private async Task AcquireStateLockAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(
            "select pg_advisory_xact_lock(hashtext(@lock_name));",
            connection,
            transaction);

        command.Parameters.AddWithValue("lock_name", $"{_schemaName}:cooperate_state");
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private async Task EnsureStorageAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        CancellationToken cancellationToken)
    {
        await using (var command = new NpgsqlCommand(BuildEnsureStorageSql(), connection, transaction))
        {
            await command.ExecuteNonQueryAsync(cancellationToken);
        }
    }

    private async Task<AppState> ReadStateAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        CancellationToken cancellationToken)
    {
        var state = AppState.CreateInitial();

        await ReadCompaniesAsync(state, connection, transaction, cancellationToken);
        await ReadUsersAsync(state, connection, transaction, cancellationToken);
        await ReadIdeasAsync(state, connection, transaction, cancellationToken);
        await ReadIdeaEligibilityAsync(state, connection, transaction, cancellationToken);
        await ReadVotesAsync(state, connection, transaction, cancellationToken);
        await ReadSessionsAsync(state, connection, transaction, cancellationToken);

        return state;
    }

    private async Task ReadCompaniesAsync(AppState state, NpgsqlConnection connection, NpgsqlTransaction transaction, CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(
            $$"""
            select id, name, inn, description, created_at, idea_monthly_limit, vote_approval_percent
            from {{_companiesTable}}
            order by created_at, id;
            """,
            connection,
            transaction);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            state.Companies.Add(new Company
            {
                Id = reader.GetString(0),
                Name = reader.GetString(1),
                Inn = reader.GetString(2),
                Description = reader.IsDBNull(3) ? null : reader.GetString(3),
                CreatedAt = reader.GetFieldValue<DateTimeOffset>(4).ToString("O"),
                Settings = new CompanySettings
                {
                    IdeaMonthlyLimit = reader.GetInt32(5),
                    VoteApprovalPercent = reader.GetInt32(6)
                }
            });
        }
    }

    private async Task ReadUsersAsync(AppState state, NpgsqlConnection connection, NpgsqlTransaction transaction, CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(
            $$"""
            select id, company_id, full_name, login, phone, role, position, avatar_url, password_hash, is_active, created_at
            from {{_usersTable}}
            order by created_at, id;
            """,
            connection,
            transaction);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            state.Users.Add(new UserAccount
            {
                Id = reader.GetString(0),
                CompanyId = reader.GetString(1),
                FullName = reader.GetString(2),
                Login = reader.GetString(3),
                Phone = reader.GetString(4),
                Role = reader.GetString(5),
                Position = reader.GetString(6),
                AvatarUrl = reader.IsDBNull(7) ? null : reader.GetString(7),
                PasswordHash = reader.GetString(8),
                IsActive = reader.GetBoolean(9),
                CreatedAt = reader.GetFieldValue<DateTimeOffset>(10).ToString("O")
            });
        }
    }

    private async Task ReadIdeasAsync(AppState state, NpgsqlConnection connection, NpgsqlTransaction transaction, CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(
            $$"""
            select
                id,
                company_id,
                author_id,
                voting_type,
                title,
                description,
                status,
                moderation_comment,
                moderated_at,
                moderated_by,
                voting_opened_at,
                voting_closed_at,
                director_review_requested_at,
                director_decision_at,
                director_decision_by,
                director_comment,
                archived_at,
                created_at,
                updated_at
            from {{_ideasTable}}
            order by created_at, id;
            """,
            connection,
            transaction);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            state.Ideas.Add(new Idea
            {
                Id = reader.GetString(0),
                CompanyId = reader.GetString(1),
                AuthorId = reader.GetString(2),
                VotingType = reader.GetString(3),
                Title = reader.GetString(4),
                Description = reader.GetString(5),
                Status = reader.GetString(6),
                ModerationComment = ReadNullableString(reader, 7),
                ModeratedAt = ReadNullableTimestamp(reader, 8),
                ModeratedBy = ReadNullableString(reader, 9),
                VotingOpenedAt = ReadNullableTimestamp(reader, 10),
                VotingClosedAt = ReadNullableTimestamp(reader, 11),
                DirectorReviewRequestedAt = ReadNullableTimestamp(reader, 12),
                DirectorDecisionAt = ReadNullableTimestamp(reader, 13),
                DirectorDecisionBy = ReadNullableString(reader, 14),
                DirectorComment = ReadNullableString(reader, 15),
                ArchivedAt = ReadNullableTimestamp(reader, 16),
                CreatedAt = reader.GetFieldValue<DateTimeOffset>(17).ToString("O"),
                UpdatedAt = reader.GetFieldValue<DateTimeOffset>(18).ToString("O")
            });
        }
    }

    private async Task ReadIdeaEligibilityAsync(AppState state, NpgsqlConnection connection, NpgsqlTransaction transaction, CancellationToken cancellationToken)
    {
        var ideasById = state.Ideas.ToDictionary(idea => idea.Id, StringComparer.Ordinal);

        await using var command = new NpgsqlCommand(
            $$"""
            select idea_id, user_id
            from {{_ideaEligibilityTable}}
            order by idea_id, user_id;
            """,
            connection,
            transaction);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            var ideaId = reader.GetString(0);

            if (ideasById.TryGetValue(ideaId, out var idea))
            {
                idea.VotingEligibleUserIds.Add(reader.GetString(1));
            }
        }
    }

    private async Task ReadVotesAsync(AppState state, NpgsqlConnection connection, NpgsqlTransaction transaction, CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(
            $$"""
            select id, idea_id, user_id, value, created_at
            from {{_votesTable}}
            order by created_at, id;
            """,
            connection,
            transaction);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            state.Votes.Add(new IdeaVote
            {
                Id = reader.GetString(0),
                IdeaId = reader.GetString(1),
                UserId = reader.GetString(2),
                Value = reader.GetString(3),
                CreatedAt = reader.GetFieldValue<DateTimeOffset>(4).ToString("O")
            });
        }
    }

    private async Task ReadSessionsAsync(AppState state, NpgsqlConnection connection, NpgsqlTransaction transaction, CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(
            $$"""
            select id, user_id, token, created_at, expires_at
            from {{_sessionsTable}}
            order by created_at, id;
            """,
            connection,
            transaction);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            state.Sessions.Add(new Session
            {
                Id = reader.GetString(0),
                UserId = reader.GetString(1),
                Token = reader.GetString(2),
                CreatedAt = reader.GetFieldValue<DateTimeOffset>(3).ToString("O"),
                ExpiresAt = reader.GetFieldValue<DateTimeOffset>(4).ToString("O")
            });
        }
    }

    private async Task WriteStateAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        AppState state,
        CancellationToken cancellationToken)
    {
        await DeleteExistingDataAsync(connection, transaction, cancellationToken);
        await InsertCompaniesAsync(state, connection, transaction, cancellationToken);
        await InsertUsersAsync(state, connection, transaction, cancellationToken);
        await InsertIdeasAsync(state, connection, transaction, cancellationToken);
        await InsertIdeaEligibilityAsync(state, connection, transaction, cancellationToken);
        await InsertVotesAsync(state, connection, transaction, cancellationToken);
        await InsertSessionsAsync(state, connection, transaction, cancellationToken);
    }

    private async Task DeleteExistingDataAsync(NpgsqlConnection connection, NpgsqlTransaction transaction, CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(
            $$"""
            delete from {{_ideaEligibilityTable}};
            delete from {{_votesTable}};
            delete from {{_sessionsTable}};
            delete from {{_ideasTable}};
            delete from {{_usersTable}};
            delete from {{_companiesTable}};
            """,
            connection,
            transaction);

        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private async Task InsertCompaniesAsync(AppState state, NpgsqlConnection connection, NpgsqlTransaction transaction, CancellationToken cancellationToken)
    {
        foreach (var company in state.Companies)
        {
            await using var command = new NpgsqlCommand(
                $$"""
                insert into {{_companiesTable}} (
                    id, name, inn, description, created_at, idea_monthly_limit, vote_approval_percent
                ) values (
                    @id, @name, @inn, @description, @created_at, @idea_monthly_limit, @vote_approval_percent
                );
                """,
                connection,
                transaction);

            command.Parameters.AddWithValue("id", company.Id);
            command.Parameters.AddWithValue("name", company.Name);
            command.Parameters.AddWithValue("inn", company.Inn);
            command.Parameters.AddWithValue("description", (object?)company.Description ?? DBNull.Value);
            command.Parameters.AddWithValue("created_at", ParseTimestamp(company.CreatedAt));
            command.Parameters.AddWithValue("idea_monthly_limit", company.Settings.IdeaMonthlyLimit);
            command.Parameters.AddWithValue("vote_approval_percent", company.Settings.VoteApprovalPercent);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }
    }

    private async Task InsertUsersAsync(AppState state, NpgsqlConnection connection, NpgsqlTransaction transaction, CancellationToken cancellationToken)
    {
        foreach (var user in state.Users)
        {
            await using var command = new NpgsqlCommand(
                $$"""
                insert into {{_usersTable}} (
                    id, company_id, full_name, login, phone, role, position, avatar_url, password_hash, is_active, created_at
                ) values (
                    @id, @company_id, @full_name, @login, @phone, @role, @position, @avatar_url, @password_hash, @is_active, @created_at
                );
                """,
                connection,
                transaction);

            command.Parameters.AddWithValue("id", user.Id);
            command.Parameters.AddWithValue("company_id", user.CompanyId);
            command.Parameters.AddWithValue("full_name", user.FullName);
            command.Parameters.AddWithValue("login", user.Login);
            command.Parameters.AddWithValue("phone", user.Phone);
            command.Parameters.AddWithValue("role", user.Role);
            command.Parameters.AddWithValue("position", user.Position);
            command.Parameters.AddWithValue("avatar_url", (object?)user.AvatarUrl ?? DBNull.Value);
            command.Parameters.AddWithValue("password_hash", user.PasswordHash);
            command.Parameters.AddWithValue("is_active", user.IsActive);
            command.Parameters.AddWithValue("created_at", ParseTimestamp(user.CreatedAt));
            await command.ExecuteNonQueryAsync(cancellationToken);
        }
    }

    private async Task InsertIdeasAsync(AppState state, NpgsqlConnection connection, NpgsqlTransaction transaction, CancellationToken cancellationToken)
    {
        foreach (var idea in state.Ideas)
        {
            await using var command = new NpgsqlCommand(
                $$"""
                insert into {{_ideasTable}} (
                    id,
                    company_id,
                    author_id,
                    voting_type,
                    title,
                    description,
                    status,
                    moderation_comment,
                    moderated_at,
                    moderated_by,
                    voting_opened_at,
                    voting_closed_at,
                    director_review_requested_at,
                    director_decision_at,
                    director_decision_by,
                    director_comment,
                    archived_at,
                    created_at,
                    updated_at
                ) values (
                    @id,
                    @company_id,
                    @author_id,
                    @voting_type,
                    @title,
                    @description,
                    @status,
                    @moderation_comment,
                    @moderated_at,
                    @moderated_by,
                    @voting_opened_at,
                    @voting_closed_at,
                    @director_review_requested_at,
                    @director_decision_at,
                    @director_decision_by,
                    @director_comment,
                    @archived_at,
                    @created_at,
                    @updated_at
                );
                """,
                connection,
                transaction);

            command.Parameters.AddWithValue("id", idea.Id);
            command.Parameters.AddWithValue("company_id", idea.CompanyId);
            command.Parameters.AddWithValue("author_id", idea.AuthorId);
            command.Parameters.AddWithValue("voting_type", idea.VotingType);
            command.Parameters.AddWithValue("title", idea.Title);
            command.Parameters.AddWithValue("description", idea.Description);
            command.Parameters.AddWithValue("status", idea.Status);
            command.Parameters.AddWithValue("moderation_comment", DbString(idea.ModerationComment));
            command.Parameters.AddWithValue("moderated_at", DbTimestamp(idea.ModeratedAt));
            command.Parameters.AddWithValue("moderated_by", DbString(idea.ModeratedBy));
            command.Parameters.AddWithValue("voting_opened_at", DbTimestamp(idea.VotingOpenedAt));
            command.Parameters.AddWithValue("voting_closed_at", DbTimestamp(idea.VotingClosedAt));
            command.Parameters.AddWithValue("director_review_requested_at", DbTimestamp(idea.DirectorReviewRequestedAt));
            command.Parameters.AddWithValue("director_decision_at", DbTimestamp(idea.DirectorDecisionAt));
            command.Parameters.AddWithValue("director_decision_by", DbString(idea.DirectorDecisionBy));
            command.Parameters.AddWithValue("director_comment", DbString(idea.DirectorComment));
            command.Parameters.AddWithValue("archived_at", DbTimestamp(idea.ArchivedAt));
            command.Parameters.AddWithValue("created_at", ParseTimestamp(idea.CreatedAt));
            command.Parameters.AddWithValue("updated_at", ParseTimestamp(idea.UpdatedAt));
            await command.ExecuteNonQueryAsync(cancellationToken);
        }
    }

    private async Task InsertIdeaEligibilityAsync(AppState state, NpgsqlConnection connection, NpgsqlTransaction transaction, CancellationToken cancellationToken)
    {
        foreach (var idea in state.Ideas)
        {
            foreach (var userId in idea.VotingEligibleUserIds)
            {
                await using var command = new NpgsqlCommand(
                    $$"""
                    insert into {{_ideaEligibilityTable}} (idea_id, user_id)
                    values (@idea_id, @user_id);
                    """,
                    connection,
                    transaction);

                command.Parameters.AddWithValue("idea_id", idea.Id);
                command.Parameters.AddWithValue("user_id", userId);
                await command.ExecuteNonQueryAsync(cancellationToken);
            }
        }
    }

    private async Task InsertVotesAsync(AppState state, NpgsqlConnection connection, NpgsqlTransaction transaction, CancellationToken cancellationToken)
    {
        foreach (var vote in state.Votes)
        {
            await using var command = new NpgsqlCommand(
                $$"""
                insert into {{_votesTable}} (id, idea_id, user_id, value, created_at)
                values (@id, @idea_id, @user_id, @value, @created_at);
                """,
                connection,
                transaction);

            command.Parameters.AddWithValue("id", vote.Id);
            command.Parameters.AddWithValue("idea_id", vote.IdeaId);
            command.Parameters.AddWithValue("user_id", vote.UserId);
            command.Parameters.AddWithValue("value", vote.Value);
            command.Parameters.AddWithValue("created_at", ParseTimestamp(vote.CreatedAt));
            await command.ExecuteNonQueryAsync(cancellationToken);
        }
    }

    private async Task InsertSessionsAsync(AppState state, NpgsqlConnection connection, NpgsqlTransaction transaction, CancellationToken cancellationToken)
    {
        foreach (var session in state.Sessions)
        {
            await using var command = new NpgsqlCommand(
                $$"""
                insert into {{_sessionsTable}} (id, user_id, token, created_at, expires_at)
                values (@id, @user_id, @token, @created_at, @expires_at);
                """,
                connection,
                transaction);

            command.Parameters.AddWithValue("id", session.Id);
            command.Parameters.AddWithValue("user_id", session.UserId);
            command.Parameters.AddWithValue("token", session.Token);
            command.Parameters.AddWithValue("created_at", ParseTimestamp(session.CreatedAt));
            command.Parameters.AddWithValue("expires_at", ParseTimestamp(session.ExpiresAt));
            await command.ExecuteNonQueryAsync(cancellationToken);
        }
    }

    private string BuildEnsureStorageSql()
    {
        var createSchema = _schemaName == "public"
            ? string.Empty
            : $"create schema if not exists {_quotedSchemaName};";

        return $$"""
            {{createSchema}}

            create table if not exists {{_companiesTable}} (
                id text primary key,
                name text not null,
                inn text not null,
                description text null,
                created_at timestamptz not null,
                idea_monthly_limit integer not null,
                vote_approval_percent integer not null
            );

            create table if not exists {{_usersTable}} (
                id text primary key,
                company_id text not null references {{_companiesTable}}(id) on delete cascade,
                full_name text not null,
                login text not null,
                phone text not null,
                role text not null,
                position text not null,
                avatar_url text null,
                password_hash text not null,
                is_active boolean not null,
                created_at timestamptz not null
            );

            create table if not exists {{_ideasTable}} (
                id text primary key,
                company_id text not null references {{_companiesTable}}(id) on delete cascade,
                author_id text not null references {{_usersTable}}(id) on delete cascade,
                voting_type text not null,
                title text not null,
                description text not null,
                status text not null,
                moderation_comment text null,
                moderated_at timestamptz null,
                moderated_by text null references {{_usersTable}}(id) on delete set null,
                voting_opened_at timestamptz null,
                voting_closed_at timestamptz null,
                director_review_requested_at timestamptz null,
                director_decision_at timestamptz null,
                director_decision_by text null references {{_usersTable}}(id) on delete set null,
                director_comment text null,
                archived_at timestamptz null,
                created_at timestamptz not null,
                updated_at timestamptz not null
            );

            create table if not exists {{_ideaEligibilityTable}} (
                idea_id text not null references {{_ideasTable}}(id) on delete cascade,
                user_id text not null references {{_usersTable}}(id) on delete cascade,
                primary key (idea_id, user_id)
            );

            create table if not exists {{_votesTable}} (
                id text primary key,
                idea_id text not null references {{_ideasTable}}(id) on delete cascade,
                user_id text not null references {{_usersTable}}(id) on delete cascade,
                value text not null,
                created_at timestamptz not null,
                unique (idea_id, user_id)
            );

            create table if not exists {{_sessionsTable}} (
                id text primary key,
                user_id text not null references {{_usersTable}}(id) on delete cascade,
                token text not null unique,
                created_at timestamptz not null,
                expires_at timestamptz not null
            );

            create unique index if not exists user_accounts_login_key on {{_usersTable}} (login);
            create unique index if not exists user_accounts_phone_key on {{_usersTable}} (phone);
            create index if not exists user_accounts_company_id_idx on {{_usersTable}} (company_id);
            create index if not exists ideas_company_id_idx on {{_ideasTable}} (company_id);
            create index if not exists ideas_author_id_idx on {{_ideasTable}} (author_id);
            create index if not exists ideas_status_idx on {{_ideasTable}} (status);
            create index if not exists idea_votes_idea_id_idx on {{_votesTable}} (idea_id);
            create index if not exists app_sessions_user_id_idx on {{_sessionsTable}} (user_id);
            create index if not exists app_sessions_expires_at_idx on {{_sessionsTable}} (expires_at);

            alter table {{_companiesTable}} enable row level security;
            alter table {{_usersTable}} enable row level security;
            alter table {{_ideasTable}} enable row level security;
            alter table {{_ideaEligibilityTable}} enable row level security;
            alter table {{_votesTable}} enable row level security;
            alter table {{_sessionsTable}} enable row level security;

            revoke all on table {{_companiesTable}} from anon, authenticated;
            revoke all on table {{_usersTable}} from anon, authenticated;
            revoke all on table {{_ideasTable}} from anon, authenticated;
            revoke all on table {{_ideaEligibilityTable}} from anon, authenticated;
            revoke all on table {{_votesTable}} from anon, authenticated;
            revoke all on table {{_sessionsTable}} from anon, authenticated;
            """;
    }

    private string Qualified(string tableName) => $"{_quotedSchemaName}.{QuoteIdentifier(tableName)}";

    private static string? ReadNullableString(NpgsqlDataReader reader, int ordinal)
    {
        return reader.IsDBNull(ordinal) ? null : reader.GetString(ordinal);
    }

    private static string? ReadNullableTimestamp(NpgsqlDataReader reader, int ordinal)
    {
        return reader.IsDBNull(ordinal)
            ? null
            : reader.GetFieldValue<DateTimeOffset>(ordinal).ToString("O");
    }

    private static object DbString(string? value)
    {
        return value is null ? DBNull.Value : value;
    }

    private static object DbTimestamp(string? value)
    {
        return value is null ? DBNull.Value : ParseTimestamp(value);
    }

    private static DateTimeOffset ParseTimestamp(string value)
    {
        return DateTimeOffset.Parse(value);
    }

    private static string NormalizeIdentifier(string value, string kind)
    {
        var trimmed = (value ?? string.Empty).Trim();

        if (string.IsNullOrWhiteSpace(trimmed) ||
            trimmed.Any(ch => !(char.IsLetterOrDigit(ch) || ch == '_')))
        {
            throw new InvalidOperationException($"Invalid {kind} identifier: {value}");
        }

        return trimmed;
    }

    private static string QuoteIdentifier(string value)
    {
        return $"\"{NormalizeIdentifier(value, "identifier")}\"";
    }
}
