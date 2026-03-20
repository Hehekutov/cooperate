using Backend.Domain;
using Backend.Infrastructure;

namespace Backend.Services;

public sealed class AppService
{
    private readonly IAppStateStore _store;
    private readonly AppOptions _options;
    private static readonly IReadOnlyDictionary<string, int> RoleSortOrder = new Dictionary<string, int>(StringComparer.Ordinal)
    {
        [Roles.Director] = 0,
        [Roles.Admin] = 1,
        [Roles.Employee] = 2
    };

    public AppService(IAppStateStore store, AppOptions options)
    {
        _store = store;
        _options = options;
    }

    public Task<AuthResponse> RegisterCompanyAsync(RegisterCompanyRequest input, CancellationToken cancellationToken = default)
    {
        return _store.UpdateAsync(state =>
        {
            var now = DateTimeOffset.UtcNow;
            var nowIso = now.ToString("O");
            CleanupExpiredSessions(state, now);

            var companyName = CleanRequiredString(input.CompanyName, "companyName", 120);
            var inn = SecurityHelpers.NormalizeInn(input.CompanyInn);
            var description = CleanOptionalString(input.CompanyDescription, "companyDescription", 500);
            var directorName = CleanRequiredString(input.DirectorName, "directorName", 120);
            var directorLogin = SecurityHelpers.NormalizeLogin(input.DirectorLogin);
            var position = CleanOptionalString(input.DirectorPosition, "directorPosition", 120) ?? "Director";
            var phone = SecurityHelpers.NormalizePhone(input.Phone);
            var passwordHash = SecurityHelpers.HashPassword(input.Password);

            AssertCompanyPhoneIsAvailable(state, phone);
            AssertCompanyLoginIsAvailable(state, directorLogin);

            var company = new Company
            {
                Id = SecurityHelpers.CreateId("company"),
                Name = companyName,
                Inn = inn,
                Description = description,
                CreatedAt = nowIso,
                Settings = new CompanySettings
                {
                    IdeaMonthlyLimit = _options.IdeaMonthlyLimit,
                    VoteApprovalPercent = BusinessRules.VoteApprovalPercent
                }
            };

            var director = new UserAccount
            {
                Id = SecurityHelpers.CreateId("user"),
                CompanyId = company.Id,
                FullName = directorName,
                Login = directorLogin,
                Phone = phone,
                Role = Roles.Director,
                Position = position,
                AvatarUrl = CleanOptionalString(input.AvatarUrl, "avatarUrl", 500),
                PasswordHash = passwordHash,
                IsActive = true,
                CreatedAt = nowIso
            };

            state.Companies.Add(company);
            state.Users.Add(director);

            var session = CreateSession(state, director.Id, now);

            return new AuthResponse
            {
                Token = session.Token,
                ExpiresAt = session.ExpiresAt,
                Company = SanitizeCompany(company),
                User = SanitizeUser(director)
            };
        }, cancellationToken);
    }

    public Task<AuthResponse> LoginAsync(LoginRequest input, CancellationToken cancellationToken = default)
    {
        return _store.UpdateAsync(state =>
        {
            var now = DateTimeOffset.UtcNow;
            var nowIso = now.ToString("O");
            CleanupExpiredSessions(state, now);

            var login = NormalizeLoginOrPhone(input.Login, input.Phone);
            var password = input.Password ?? string.Empty;
            var user = state.Users.FirstOrDefault(entry =>
                entry.IsActive &&
                (string.Equals(entry.Login, login, StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(entry.Phone, login, StringComparison.Ordinal)));

            if (user is null || !SecurityHelpers.VerifyPassword(password, user.PasswordHash))
            {
                throw new AppException(StatusCodes.Status401Unauthorized, "UNAUTHORIZED", "Invalid login or password");
            }

            var company = FindCompanyOrThrow(state, user.CompanyId);
            var session = CreateSession(state, user.Id, now);

            return new AuthResponse
            {
                Token = session.Token,
                ExpiresAt = session.ExpiresAt,
                Company = SanitizeCompany(company),
                User = SanitizeUser(user)
            };
        }, cancellationToken);
    }

    public Task LogoutAsync(string token, CancellationToken cancellationToken = default)
    {
        return _store.UpdateAsync(state =>
        {
            state.Sessions = state.Sessions
                .Where(session => !string.Equals(session.Token, token, StringComparison.Ordinal))
                .ToList();
        }, cancellationToken);
    }

    public async Task<RequestAuthContext?> GetContextByTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return null;
        }

        var state = await _store.GetStateAsync(cancellationToken);
        var now = DateTimeOffset.UtcNow;
        var session = state.Sessions.FirstOrDefault(entry =>
            string.Equals(entry.Token, token, StringComparison.Ordinal) &&
            DateTimeOffset.Parse(entry.ExpiresAt) > now);

        if (session is null)
        {
            return null;
        }

        var user = state.Users.FirstOrDefault(entry => entry.Id == session.UserId && entry.IsActive);

        if (user is null)
        {
            return null;
        }

        var company = state.Companies.FirstOrDefault(entry => entry.Id == user.CompanyId);

        if (company is null)
        {
            return null;
        }

        return new RequestAuthContext
        {
            Token = token,
            Company = SanitizeCompany(company),
            User = SanitizeUser(user)
        };
    }

    public async Task<CompanyOverviewDto> GetCompanyOverviewAsync(UserDto actor, CancellationToken cancellationToken = default)
    {
        var state = await _store.GetStateAsync(cancellationToken);
        var company = FindCompanyOrThrow(state, actor.CompanyId);

        return new CompanyOverviewDto
        {
            Company = SanitizeCompany(company),
            CurrentUser = actor,
            Stats = BuildCompanyStats(state, actor.CompanyId)
        };
    }

    public async Task<EmployeeListDto> ListEmployeesAsync(UserDto actor, CancellationToken cancellationToken = default)
    {
        var state = await _store.GetStateAsync(cancellationToken);

        var items = state.Users
            .Where(user => user.CompanyId == actor.CompanyId && user.IsActive)
            .OrderBy(user => RoleSortOrder[user.Role])
            .ThenBy(user => user.FullName, StringComparer.Ordinal)
            .Select(SanitizeUser)
            .ToList();

        return new EmployeeListDto
        {
            Items = items,
            Total = items.Count
        };
    }

    public Task<UserDto> AddEmployeeAsync(UserDto actor, CreateEmployeeRequest input, CancellationToken cancellationToken = default)
    {
        if (!string.Equals(actor.Role, Roles.Director, StringComparison.Ordinal))
        {
            throw new AppException(StatusCodes.Status403Forbidden, "FORBIDDEN", "Only the director can add employees");
        }

        return _store.UpdateAsync(state =>
        {
            var nowIso = DateTimeOffset.UtcNow.ToString("O");
            var company = FindCompanyOrThrow(state, actor.CompanyId);
            var role = (input.Role ?? string.Empty).Trim();
            var fullName = CleanRequiredString(input.FullName, "fullName", 120);
            var login = SecurityHelpers.NormalizeLogin(input.Login);
            var phone = SecurityHelpers.NormalizePhone(input.Phone);
            var position = CleanOptionalString(input.Position, "position", 120) ?? "Employee";
            var avatarUrl = CleanOptionalString(input.AvatarUrl, "avatarUrl", 500);
            var passwordHash = SecurityHelpers.HashPassword(input.Password);

            AssertRoleCanBeCreated(role);
            AssertCompanyLoginIsAvailable(state, login);
            AssertCompanyPhoneIsAvailable(state, phone);

            var user = new UserAccount
            {
                Id = SecurityHelpers.CreateId("user"),
                CompanyId = company.Id,
                FullName = fullName,
                Login = login,
                Phone = phone,
                Role = role,
                Position = position,
                AvatarUrl = avatarUrl,
                PasswordHash = passwordHash,
                IsActive = true,
                CreatedAt = nowIso
            };

            state.Users.Add(user);
            return SanitizeUser(user);
        }, cancellationToken);
    }

    public Task<IdeaDto> CreateIdeaAsync(UserDto actor, CreateIdeaRequest input, CancellationToken cancellationToken = default)
    {
        if (string.Equals(actor.Role, Roles.Director, StringComparison.Ordinal))
        {
            throw new AppException(StatusCodes.Status403Forbidden, "FORBIDDEN", "The director cannot create ideas");
        }

        return _store.UpdateAsync(state =>
        {
            var now = DateTimeOffset.UtcNow;
            var nowIso = now.ToString("O");
            var title = CleanRequiredString(input.Title, "title", 160);
            var description = CleanRequiredString(input.Description, "description", 3000);
            var votingType = (input.VotingType ?? string.Empty).Trim().ToLowerInvariant();
            var currentMonthIdeasCount = state.Ideas.Count(idea =>
                idea.AuthorId == actor.Id &&
                idea.CompanyId == actor.CompanyId &&
                IsIdeaCreatedInSameUtcMonth(idea.CreatedAt, now));

            if (currentMonthIdeasCount >= _options.IdeaMonthlyLimit)
            {
                throw new AppException(StatusCodes.Status409Conflict, "CONFLICT", $"Monthly limit reached: only {_options.IdeaMonthlyLimit} ideas are allowed per user");
            }

            var idea = new Idea
            {
                Id = SecurityHelpers.CreateId("idea"),
                CompanyId = actor.CompanyId,
                AuthorId = actor.Id,
                VotingType = votingType,
                Title = title,
                Description = description,
                Status = IdeaStatuses.PendingModeration,
                CreatedAt = nowIso,
                UpdatedAt = nowIso
            };

            state.Ideas.Add(idea);
            var context = BuildIdeaProjectionContext(state, [idea], actor);
            return BuildIdeaDto(idea, actor, context);
        }, cancellationToken);
    }

    public async Task<IdeaListDto> ListIdeasAsync(UserDto actor, IdeaListQuery? query, CancellationToken cancellationToken = default)
    {
        var state = await _store.GetStateAsync(cancellationToken);
        var scope = string.IsNullOrWhiteSpace(query?.Scope) ? "active" : query!.Scope!;
        var statusFilter = string.IsNullOrWhiteSpace(query?.Status) ? null : query!.Status!;
        var searchQuery = (query?.Q ?? string.Empty).Trim().ToLowerInvariant();
        var limit = query?.Limit;
        var sort = string.IsNullOrWhiteSpace(query?.Sort) ? "recent" : query!.Sort!;

        IEnumerable<Idea> ideas = state.Ideas.Where(idea => idea.CompanyId == actor.CompanyId);

        ideas = scope switch
        {
            "active" => ideas.Where(idea => BusinessRules.ActiveIdeaStatuses.Contains(idea.Status)),
            "archive" => ideas.Where(idea => BusinessRules.ArchiveIdeaStatuses.Contains(idea.Status)),
            "mine" => ideas.Where(idea => idea.AuthorId == actor.Id),
            "moderation" => ideas.Where(idea => idea.Status == IdeaStatuses.PendingModeration),
            "director_review" => ideas.Where(idea => idea.Status == IdeaStatuses.DirectorReview),
            "ai" => ideas.Where(idea => GetAiRecommendationScore(idea) >= 60),
            "all" => ideas,
            _ => throw new AppException(StatusCodes.Status400BadRequest, "BAD_REQUEST", "scope must be one of: active, archive, mine, moderation, director_review, ai, all")
        };

        if (!string.IsNullOrWhiteSpace(statusFilter))
        {
            ideas = ideas.Where(idea => idea.Status == statusFilter);
        }

        if (!string.IsNullOrWhiteSpace(searchQuery))
        {
            ideas = ideas.Where(idea =>
                idea.Title.Contains(searchQuery, StringComparison.OrdinalIgnoreCase) ||
                idea.Description.Contains(searchQuery, StringComparison.OrdinalIgnoreCase));
        }

        var filteredIdeas = ideas.ToList();
        var context = BuildIdeaProjectionContext(state, filteredIdeas, actor);

        filteredIdeas = string.Equals(scope, "ai", StringComparison.Ordinal)
            ? filteredIdeas.OrderByDescending(idea => context.AiScoresByIdeaId[idea.Id])
                .ThenByDescending(idea => context.UpdatedAtByIdeaId[idea.Id])
                .ToList()
            : string.Equals(sort, "support", StringComparison.Ordinal)
            ? filteredIdeas.OrderByDescending(idea => context.VoteSummariesByIdeaId[idea.Id].ApprovalPercent)
                .ThenByDescending(idea => context.UpdatedAtByIdeaId[idea.Id])
                .ToList()
            : filteredIdeas.OrderByDescending(idea => context.UpdatedAtByIdeaId[idea.Id]).ToList();

        if (limit is > 0)
        {
            filteredIdeas = filteredIdeas.Take(limit.Value).ToList();
        }

        var items = filteredIdeas
            .Select(idea => BuildIdeaDto(idea, actor, context))
            .ToList();

        return new IdeaListDto
        {
            Items = items,
            Total = items.Count
        };
    }

    public async Task<IdeaDto> GetIdeaAsync(UserDto actor, string ideaId, CancellationToken cancellationToken = default)
    {
        var state = await _store.GetStateAsync(cancellationToken);
        var idea = FindIdeaOrThrow(state, actor.CompanyId, ideaId);
        var context = BuildIdeaProjectionContext(state, [idea], actor);
        return BuildIdeaDto(idea, actor, context);
    }

    public Task<IdeaDto> ModerateIdeaAsync(UserDto actor, string ideaId, ModerateIdeaRequest input, CancellationToken cancellationToken = default)
    {
        if (!string.Equals(actor.Role, Roles.Admin, StringComparison.Ordinal) &&
            !string.Equals(actor.Role, Roles.Director, StringComparison.Ordinal))
        {
            throw new AppException(StatusCodes.Status403Forbidden, "FORBIDDEN", "Only an admin or the director can moderate ideas");
        }

        return _store.UpdateAsync(state =>
        {
            var nowIso = DateTimeOffset.UtcNow.ToString("O");
            var idea = FindIdeaOrThrow(state, actor.CompanyId, ideaId);

            if (idea.Status != IdeaStatuses.PendingModeration)
            {
                throw new AppException(StatusCodes.Status409Conflict, "CONFLICT", "Only ideas awaiting moderation can be reviewed");
            }

            idea.ModeratedBy = actor.Id;
            idea.ModeratedAt = nowIso;
            idea.ModerationComment = CleanOptionalString(input.Comment, "comment", 1000);
            idea.UpdatedAt = nowIso;

            if (input.Approved)
            {
                idea.Status = IdeaStatuses.Voting;
                idea.VotingOpenedAt = nowIso;
                idea.VotingEligibleUserIds = state.Users
                    .Where(user => user.CompanyId == actor.CompanyId && user.IsActive && user.Role != Roles.Director)
                    .Select(user => user.Id)
                    .ToList();

                if (idea.VotingEligibleUserIds.Count == 0)
                {
                    idea.Status = IdeaStatuses.DirectorReview;
                    idea.VotingClosedAt = nowIso;
                    idea.DirectorReviewRequestedAt = nowIso;
                }
            }
            else
            {
                idea.Status = IdeaStatuses.RejectedByAdmin;
                idea.ArchivedAt = nowIso;
                idea.VotingEligibleUserIds = [];
            }

            var context = BuildIdeaProjectionContext(state, [idea], actor);
            return BuildIdeaDto(idea, actor, context);
        }, cancellationToken);
    }

    public Task<IdeaDto> VoteIdeaAsync(UserDto actor, string ideaId, VoteIdeaRequest input, CancellationToken cancellationToken = default)
    {
        if (string.Equals(actor.Role, Roles.Director, StringComparison.Ordinal))
        {
            throw new AppException(StatusCodes.Status403Forbidden, "FORBIDDEN", "The director does not participate in employee voting");
        }

        return _store.UpdateAsync(state =>
        {
            var nowIso = DateTimeOffset.UtcNow.ToString("O");
            var idea = FindIdeaOrThrow(state, actor.CompanyId, ideaId);
            var value = (input.Value ?? string.Empty).Trim();

            if (idea.Status != IdeaStatuses.Voting)
            {
                throw new AppException(StatusCodes.Status409Conflict, "CONFLICT", "Voting is not open for this idea");
            }

            if (!idea.VotingEligibleUserIds.Contains(actor.Id, StringComparer.Ordinal))
            {
                throw new AppException(StatusCodes.Status403Forbidden, "FORBIDDEN", "You are not eligible to vote on this idea");
            }

            if (value is not ("for" or "against"))
            {
                throw new AppException(StatusCodes.Status400BadRequest, "BAD_REQUEST", "value must be one of: for, against");
            }

            var existingVote = state.Votes.FirstOrDefault(vote => vote.IdeaId == idea.Id && vote.UserId == actor.Id);

            if (existingVote is not null)
            {
                throw new AppException(StatusCodes.Status409Conflict, "CONFLICT", "You have already voted for this idea");
            }

            state.Votes.Add(new IdeaVote
            {
                Id = SecurityHelpers.CreateId("vote"),
                IdeaId = idea.Id,
                UserId = actor.Id,
                Value = value,
                CreatedAt = nowIso
            });

            var votes = GetVoteSummary(state, idea);

            if (votes.ApprovalPercent > BusinessRules.VoteApprovalPercent)
            {
                idea.Status = IdeaStatuses.DirectorReview;
                idea.VotingClosedAt = nowIso;
                idea.DirectorReviewRequestedAt = nowIso;
            }
            else if (votes.Total >= votes.EligibleVoters)
            {
                idea.Status = IdeaStatuses.RejectedByVote;
                idea.VotingClosedAt = nowIso;
                idea.ArchivedAt = nowIso;
            }

            idea.UpdatedAt = nowIso;
            var context = BuildIdeaProjectionContext(state, [idea], actor);
            return BuildIdeaDto(idea, actor, context);
        }, cancellationToken);
    }

    public Task<IdeaDto> MakeDirectorDecisionAsync(UserDto actor, string ideaId, DirectorDecisionRequest input, CancellationToken cancellationToken = default)
    {
        if (!string.Equals(actor.Role, Roles.Director, StringComparison.Ordinal))
        {
            throw new AppException(StatusCodes.Status403Forbidden, "FORBIDDEN", "Only the director can make the final decision");
        }

        return _store.UpdateAsync(state =>
        {
            var nowIso = DateTimeOffset.UtcNow.ToString("O");
            var idea = FindIdeaOrThrow(state, actor.CompanyId, ideaId);

            if (idea.Status != IdeaStatuses.DirectorReview)
            {
                throw new AppException(StatusCodes.Status409Conflict, "CONFLICT", "Only ideas waiting for the director can be finalized");
            }

            idea.DirectorDecisionAt = nowIso;
            idea.DirectorDecisionBy = actor.Id;
            idea.DirectorComment = CleanOptionalString(input.Comment, "comment", 1000);
            idea.ArchivedAt = nowIso;
            idea.UpdatedAt = nowIso;
            idea.Status = input.Approved ? IdeaStatuses.ApprovedByDirector : IdeaStatuses.RejectedByDirector;
            var context = BuildIdeaProjectionContext(state, [idea], actor);
            return BuildIdeaDto(idea, actor, context);
        }, cancellationToken);
    }

    private CompanyDto SanitizeCompany(Company company)
    {
        return new CompanyDto
        {
            Id = company.Id,
            Name = company.Name,
            Inn = company.Inn,
            Description = company.Description,
            CreatedAt = company.CreatedAt,
            Settings = company.Settings
        };
    }

    private static UserDto SanitizeUser(UserAccount user)
    {
        return new UserDto
        {
            Id = user.Id,
            CompanyId = user.CompanyId,
            FullName = user.FullName,
            Login = string.IsNullOrWhiteSpace(user.Login) ? user.Phone : user.Login,
            Phone = user.Phone,
            Role = user.Role,
            Position = user.Position,
            AvatarUrl = user.AvatarUrl,
            IsActive = user.IsActive,
            CreatedAt = user.CreatedAt
        };
    }

    private static void CleanupExpiredSessions(AppState state, DateTimeOffset now)
    {
        state.Sessions = state.Sessions
            .Where(session => ParseTimestamp(session.ExpiresAt) > now)
            .ToList();
    }

    private static Company FindCompanyOrThrow(AppState state, string companyId)
    {
        return state.Companies.FirstOrDefault(entry => entry.Id == companyId)
            ?? throw new AppException(StatusCodes.Status404NotFound, "NOT_FOUND", "Company was not found");
    }

    private static Idea FindIdeaOrThrow(AppState state, string companyId, string ideaId)
    {
        return state.Ideas.FirstOrDefault(entry => entry.Id == ideaId && entry.CompanyId == companyId)
            ?? throw new AppException(StatusCodes.Status404NotFound, "NOT_FOUND", "Idea was not found");
    }

    private static VoteSummaryDto GetVoteSummary(AppState state, Idea idea)
    {
        var support = 0;
        var total = 0;

        foreach (var vote in state.Votes)
        {
            if (vote.IdeaId != idea.Id)
            {
                continue;
            }

            total++;

            if (vote.Value == "for")
            {
                support++;
            }
        }

        return BuildVoteSummary(idea.VotingEligibleUserIds.Count, support, total);
    }

    private IdeaDto BuildIdeaDto(Idea idea, UserDto? viewer, IdeaProjectionContext context)
    {
        context.UsersById.TryGetValue(idea.AuthorId, out var author);
        UserAccount? moderator = null;
        UserAccount? director = null;
        IdeaVote? viewerVote = null;

        if (!string.IsNullOrWhiteSpace(idea.ModeratedBy))
        {
            context.UsersById.TryGetValue(idea.ModeratedBy, out moderator);
        }

        if (!string.IsNullOrWhiteSpace(idea.DirectorDecisionBy))
        {
            context.UsersById.TryGetValue(idea.DirectorDecisionBy, out director);
        }

        if (viewer is not null)
        {
            context.ViewerVotesByIdeaId.TryGetValue(idea.Id, out viewerVote);
        }

        var votes = context.VoteSummariesByIdeaId[idea.Id];
        var aiScore = context.AiScoresByIdeaId[idea.Id];

        return new IdeaDto
        {
            Id = idea.Id,
            CompanyId = idea.CompanyId,
            VotingType = string.IsNullOrWhiteSpace(idea.VotingType)
                ? VotingTypes.Standard
                : idea.VotingType,
            Title = idea.Title,
            Description = idea.Description,
            DescriptionPreview = idea.Description.Length > 200
                ? $"{idea.Description[..197]}..."
                : idea.Description,
            Status = idea.Status,
            Scope = BusinessRules.ActiveIdeaStatuses.Contains(idea.Status) ? "active" : "archive",
            Archived = BusinessRules.ArchiveIdeaStatuses.Contains(idea.Status),
            Author = author is null ? null : SanitizeUser(author),
            Moderation = new IdeaModerationDto
            {
                ReviewedBy = moderator is null ? null : SanitizeUser(moderator),
                Comment = idea.ModerationComment,
                ReviewedAt = idea.ModeratedAt
            },
            Votes = votes,
            ViewerVote = viewerVote is null
                ? null
                : new ViewerVoteDto
                {
                    Value = viewerVote.Value,
                    CreatedAt = viewerVote.CreatedAt
                },
            DirectorDecision = new DirectorDecisionDto
            {
                DecidedBy = director is null ? null : SanitizeUser(director),
                Comment = idea.DirectorComment,
                DecidedAt = idea.DirectorDecisionAt,
                Approved = idea.DirectorDecisionAt is null
                    ? null
                    : idea.Status == IdeaStatuses.ApprovedByDirector
            },
            Timeline = new IdeaTimelineDto
            {
                CreatedAt = idea.CreatedAt,
                UpdatedAt = idea.UpdatedAt,
                ModeratedAt = idea.ModeratedAt,
                VotingOpenedAt = idea.VotingOpenedAt,
                VotingClosedAt = idea.VotingClosedAt,
                DirectorReviewRequestedAt = idea.DirectorReviewRequestedAt,
                DirectorDecisionAt = idea.DirectorDecisionAt,
                ArchivedAt = idea.ArchivedAt
            },
            AvailableActions = viewer is null
                ? new IdeaAvailableActionsDto()
                : BuildAvailableActions(idea, viewer, viewerVote),
            AiScore = aiScore,
            AiRecommended = aiScore >= 60
        };
    }

    private static IdeaAvailableActionsDto BuildAvailableActions(Idea idea, UserDto viewer, IdeaVote? viewerVote)
    {
        return new IdeaAvailableActionsDto
        {
            CanModerate =
                (viewer.Role == Roles.Admin || viewer.Role == Roles.Director) &&
                idea.Status == IdeaStatuses.PendingModeration,
            CanVote =
                viewer.Role != Roles.Director &&
                idea.Status == IdeaStatuses.Voting &&
                idea.VotingEligibleUserIds.Contains(viewer.Id, StringComparer.Ordinal) &&
                viewerVote is null,
            CanMakeDirectorDecision =
                viewer.Role == Roles.Director &&
                idea.Status == IdeaStatuses.DirectorReview
        };
    }

    private static CompanyStatsDto BuildCompanyStats(AppState state, string companyId)
    {
        var employees = 0;
        var totalIdeas = 0;
        var activeIdeas = 0;
        var archiveIdeas = 0;
        var pendingModeration = 0;
        var waitingForDirector = 0;

        foreach (var user in state.Users)
        {
            if (user.CompanyId == companyId && user.IsActive)
            {
                employees++;
            }
        }

        foreach (var idea in state.Ideas)
        {
            if (idea.CompanyId != companyId)
            {
                continue;
            }

            totalIdeas++;

            if (BusinessRules.ActiveIdeaStatuses.Contains(idea.Status))
            {
                activeIdeas++;
            }

            if (BusinessRules.ArchiveIdeaStatuses.Contains(idea.Status))
            {
                archiveIdeas++;
            }

            if (idea.Status == IdeaStatuses.PendingModeration)
            {
                pendingModeration++;
            }

            if (idea.Status == IdeaStatuses.DirectorReview)
            {
                waitingForDirector++;
            }
        }

        return new CompanyStatsDto
        {
            Employees = employees,
            Ideas = new CompanyIdeaStatsDto
            {
                Total = totalIdeas,
                Active = activeIdeas,
                Archive = archiveIdeas,
                PendingModeration = pendingModeration,
                WaitingForDirector = waitingForDirector
            }
        };
    }

    private Session CreateSession(AppState state, string userId, DateTimeOffset now)
    {
        var nowIso = now.ToString("O");
        var expiresAt = now.AddHours(_options.SessionTtlHours).ToString("O");
        var session = new Session
        {
            Id = SecurityHelpers.CreateId("session"),
            UserId = userId,
            Token = SecurityHelpers.GenerateToken(),
            CreatedAt = nowIso,
            ExpiresAt = expiresAt
        };

        state.Sessions.Add(session);
        return session;
    }

    private static void AssertCompanyPhoneIsAvailable(AppState state, string phone)
    {
        if (state.Users.Any(user =>
                user.Phone == phone ||
                string.Equals(user.Login, phone, StringComparison.OrdinalIgnoreCase)))
        {
            throw new AppException(StatusCodes.Status409Conflict, "CONFLICT", "A user with this phone number already exists");
        }
    }

    private static void AssertCompanyLoginIsAvailable(AppState state, string login)
    {
        if (state.Users.Any(user =>
                string.Equals(user.Login, login, StringComparison.OrdinalIgnoreCase) ||
                user.Phone == login))
        {
            throw new AppException(StatusCodes.Status409Conflict, "CONFLICT", "A user with this login already exists");
        }
    }

    private static string NormalizeLoginOrPhone(string? login, string? phone)
    {
        if (!string.IsNullOrWhiteSpace(login))
        {
            return SecurityHelpers.NormalizeLogin(login);
        }

        if (!string.IsNullOrWhiteSpace(phone))
        {
            return SecurityHelpers.NormalizePhone(phone);
        }

        throw new AppException(StatusCodes.Status400BadRequest, "BAD_REQUEST", "login is required");
    }

    private static void AssertRoleCanBeCreated(string role)
    {
        if (role is not (Roles.Admin or Roles.Employee))
        {
            throw new AppException(StatusCodes.Status400BadRequest, "BAD_REQUEST", "role must be one of: admin, employee");
        }
    }

    private static bool IsIdeaCreatedInSameUtcMonth(string ideaCreatedAt, DateTimeOffset now)
    {
        var current = now.UtcDateTime;
        var created = ParseTimestamp(ideaCreatedAt).UtcDateTime;
        return current.Year == created.Year && current.Month == created.Month;
    }

    private static int GetAiRecommendationScore(Idea idea)
    {
        var text = $"{idea.Title} {idea.Description}".ToLowerInvariant();
        var score = 0;

        var positiveTerms = new Dictionary<string, int>(StringComparer.Ordinal)
        {
            ["автомат"] = 18,
            ["ускор"] = 12,
            ["оптимиза"] = 15,
            ["эконом"] = 14,
            ["улучш"] = 10,
            ["удоб"] = 8,
            ["цифров"] = 16,
            ["сокращ"] = 10,
            ["эффектив"] = 12,
            ["контрол"] = 8,
            ["качест"] = 9
        };

        foreach (var (term, weight) in positiveTerms)
        {
            if (text.Contains(term, StringComparison.Ordinal))
            {
                score += weight;
            }
        }

        if (text.Length > 300)
        {
            score += 4;
        }

        if (idea.Status == IdeaStatuses.Voting)
        {
            score += 8;
        }

        return Math.Min(score, 100);
    }

    private static IdeaProjectionContext BuildIdeaProjectionContext(AppState state, IReadOnlyCollection<Idea> ideas, UserDto? viewer)
    {
        var usersById = state.Users.ToDictionary(user => user.Id, StringComparer.Ordinal);
        var ideaIds = ideas.Select(idea => idea.Id).ToHashSet(StringComparer.Ordinal);
        var voteCountersByIdeaId = new Dictionary<string, VoteCounter>(StringComparer.Ordinal);
        var viewerVotesByIdeaId = new Dictionary<string, IdeaVote>(StringComparer.Ordinal);

        foreach (var vote in state.Votes)
        {
            if (!ideaIds.Contains(vote.IdeaId))
            {
                continue;
            }

            voteCountersByIdeaId.TryGetValue(vote.IdeaId, out var voteCounter);
            voteCounter.Total++;

            if (vote.Value == "for")
            {
                voteCounter.Support++;
            }

            voteCountersByIdeaId[vote.IdeaId] = voteCounter;

            if (viewer is not null && vote.UserId == viewer.Id)
            {
                viewerVotesByIdeaId[vote.IdeaId] = vote;
            }
        }

        var voteSummariesByIdeaId = new Dictionary<string, VoteSummaryDto>(ideaIds.Count, StringComparer.Ordinal);
        var aiScoresByIdeaId = new Dictionary<string, int>(ideaIds.Count, StringComparer.Ordinal);
        var updatedAtByIdeaId = new Dictionary<string, DateTimeOffset>(ideaIds.Count, StringComparer.Ordinal);

        foreach (var idea in ideas)
        {
            voteCountersByIdeaId.TryGetValue(idea.Id, out var voteCounter);
            voteSummariesByIdeaId[idea.Id] = BuildVoteSummary(idea.VotingEligibleUserIds.Count, voteCounter.Support, voteCounter.Total);
            aiScoresByIdeaId[idea.Id] = GetAiRecommendationScore(idea);
            updatedAtByIdeaId[idea.Id] = ParseTimestamp(idea.UpdatedAt);
        }

        return new IdeaProjectionContext(
            usersById,
            voteSummariesByIdeaId,
            viewerVotesByIdeaId,
            aiScoresByIdeaId,
            updatedAtByIdeaId);
    }

    private static VoteSummaryDto BuildVoteSummary(int eligibleVoters, int support, int total)
    {
        var approvalPercent = eligibleVoters > 0
            ? (int)Math.Round((double)support / eligibleVoters * 100, MidpointRounding.AwayFromZero)
            : 0;

        return new VoteSummaryDto
        {
            Support = support,
            Against = total - support,
            Total = total,
            EligibleVoters = eligibleVoters,
            RemainingVotes = Math.Max(eligibleVoters - total, 0),
            ApprovalPercent = approvalPercent,
            ThresholdPercent = BusinessRules.VoteApprovalPercent,
            Passed = approvalPercent > BusinessRules.VoteApprovalPercent
        };
    }

    private static DateTimeOffset ParseTimestamp(string value)
    {
        return DateTimeOffset.Parse(value);
    }

    private static string CleanRequiredString(string? value, string fieldName, int maxLength)
    {
        var text = (value ?? string.Empty).Trim();

        if (string.IsNullOrWhiteSpace(text))
        {
            throw new AppException(StatusCodes.Status400BadRequest, "BAD_REQUEST", $"{fieldName} is required");
        }

        if (text.Length > maxLength)
        {
            throw new AppException(StatusCodes.Status400BadRequest, "BAD_REQUEST", $"{fieldName} must be at most {maxLength} characters");
        }

        return text;
    }

    private static string? CleanOptionalString(string? value, string fieldName, int maxLength)
    {
        if (value is null)
        {
            return null;
        }

        var text = value.Trim();

        if (string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        if (text.Length > maxLength)
        {
            throw new AppException(StatusCodes.Status400BadRequest, "BAD_REQUEST", $"{fieldName} must be at most {maxLength} characters");
        }

        return text;
    }

    private struct VoteCounter
    {
        public int Support { get; set; }

        public int Total { get; set; }
    }

    private sealed record IdeaProjectionContext(
        IReadOnlyDictionary<string, UserAccount> UsersById,
        IReadOnlyDictionary<string, VoteSummaryDto> VoteSummariesByIdeaId,
        IReadOnlyDictionary<string, IdeaVote> ViewerVotesByIdeaId,
        IReadOnlyDictionary<string, int> AiScoresByIdeaId,
        IReadOnlyDictionary<string, DateTimeOffset> UpdatedAtByIdeaId);
}
