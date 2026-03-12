using Backend.Domain;
using Backend.Infrastructure;

namespace Backend.Services;

public sealed class AppService
{
    private readonly FileStateStore _store;
    private readonly AppOptions _options;

    public AppService(FileStateStore store, AppOptions options)
    {
        _store = store;
        _options = options;
    }

    public Task<AuthResponse> RegisterCompanyAsync(RegisterCompanyRequest input, CancellationToken cancellationToken = default)
    {
        return _store.UpdateAsync(state =>
        {
            var nowIso = DateTimeOffset.UtcNow.ToString("O");
            CleanupExpiredSessions(state, nowIso);

            var companyName = CleanRequiredString(input.CompanyName, "companyName", 120);
            var description = CleanOptionalString(input.CompanyDescription, "companyDescription", 500);
            var directorName = CleanRequiredString(input.DirectorName, "directorName", 120);
            var position = CleanOptionalString(input.DirectorPosition, "directorPosition", 120) ?? "Director";
            var phone = SecurityHelpers.NormalizePhone(input.Phone);
            var passwordHash = SecurityHelpers.HashPassword(input.Password);

            AssertCompanyPhoneIsAvailable(state, phone);

            var company = new Company
            {
                Id = SecurityHelpers.CreateId("company"),
                Name = companyName,
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

            var session = CreateSession(state, director.Id, nowIso);

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
            var nowIso = DateTimeOffset.UtcNow.ToString("O");
            CleanupExpiredSessions(state, nowIso);

            var phone = SecurityHelpers.NormalizePhone(input.Phone);
            var password = input.Password ?? string.Empty;
            var user = state.Users.FirstOrDefault(entry => entry.Phone == phone && entry.IsActive);

            if (user is null || !SecurityHelpers.VerifyPassword(password, user.PasswordHash))
            {
                throw new AppException(StatusCodes.Status401Unauthorized, "UNAUTHORIZED", "Invalid phone number or password");
            }

            var company = FindCompanyOrThrow(state, user.CompanyId);
            var session = CreateSession(state, user.Id, nowIso);

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
        var roleOrder = new Dictionary<string, int>(StringComparer.Ordinal)
        {
            [Roles.Director] = 0,
            [Roles.Admin] = 1,
            [Roles.Employee] = 2
        };

        var items = state.Users
            .Where(user => user.CompanyId == actor.CompanyId && user.IsActive)
            .OrderBy(user => roleOrder[user.Role])
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
            var phone = SecurityHelpers.NormalizePhone(input.Phone);
            var position = CleanOptionalString(input.Position, "position", 120) ?? "Employee";
            var avatarUrl = CleanOptionalString(input.AvatarUrl, "avatarUrl", 500);
            var passwordHash = SecurityHelpers.HashPassword(input.Password);

            AssertRoleCanBeCreated(role);
            AssertCompanyPhoneIsAvailable(state, phone);

            var user = new UserAccount
            {
                Id = SecurityHelpers.CreateId("user"),
                CompanyId = company.Id,
                FullName = fullName,
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
            var nowIso = DateTimeOffset.UtcNow.ToString("O");
            var title = CleanRequiredString(input.Title, "title", 160);
            var description = CleanRequiredString(input.Description, "description", 3000);
            var currentMonthIdeas = state.Ideas.Where(idea =>
                idea.AuthorId == actor.Id &&
                idea.CompanyId == actor.CompanyId &&
                IsIdeaCreatedInSameUtcMonth(idea.CreatedAt, nowIso)).ToList();

            if (currentMonthIdeas.Count >= _options.IdeaMonthlyLimit)
            {
                throw new AppException(StatusCodes.Status409Conflict, "CONFLICT", $"Monthly limit reached: only {_options.IdeaMonthlyLimit} ideas are allowed per user");
            }

            var idea = new Idea
            {
                Id = SecurityHelpers.CreateId("idea"),
                CompanyId = actor.CompanyId,
                AuthorId = actor.Id,
                Title = title,
                Description = description,
                Status = IdeaStatuses.PendingModeration,
                CreatedAt = nowIso,
                UpdatedAt = nowIso
            };

            state.Ideas.Add(idea);
            return BuildIdeaDto(state, idea, actor);
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
            "all" => ideas,
            _ => throw new AppException(StatusCodes.Status400BadRequest, "BAD_REQUEST", "scope must be one of: active, archive, mine, moderation, director_review, all")
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

        var items = ideas
            .Select(idea => BuildIdeaDto(state, idea, actor))
            .ToList();

        items = string.Equals(sort, "support", StringComparison.Ordinal)
            ? items.OrderByDescending(item => item.Votes.ApprovalPercent)
                .ThenByDescending(item => DateTimeOffset.Parse(item.Timeline.UpdatedAt))
                .ToList()
            : items.OrderByDescending(item => DateTimeOffset.Parse(item.Timeline.UpdatedAt)).ToList();

        if (limit is > 0)
        {
            items = items.Take(limit.Value).ToList();
        }

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
        return BuildIdeaDto(state, idea, actor);
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

            return BuildIdeaDto(state, idea, actor);
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
            return BuildIdeaDto(state, idea, actor);
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

            return BuildIdeaDto(state, idea, actor);
        }, cancellationToken);
    }

    public async Task SeedDemoDataAsync(CancellationToken cancellationToken = default)
    {
        await _store.SetStateAsync(AppState.CreateInitial(), cancellationToken);

        var directorAuth = await RegisterCompanyAsync(new RegisterCompanyRequest
        {
            CompanyName = "OOO Tmyv",
            CompanyDescription = "Internal idea and voting platform demo company",
            DirectorName = "Ivan Perevichkov",
            DirectorPosition = "Director",
            Phone = "+70000000001",
            Password = "director123"
        }, cancellationToken);

        var admin = await AddEmployeeAsync(directorAuth.User, new CreateEmployeeRequest
        {
            FullName = "Sofia Kolbasenko",
            Phone = "+70000000002",
            Password = "admin123",
            Role = Roles.Admin,
            Position = "Office Administrator"
        }, cancellationToken);

        var backendEngineer = await AddEmployeeAsync(directorAuth.User, new CreateEmployeeRequest
        {
            FullName = "Nikolai Pusanov",
            Phone = "+70000000003",
            Password = "employee123",
            Role = Roles.Employee,
            Position = "Backend Engineer"
        }, cancellationToken);

        var analyst = await AddEmployeeAsync(directorAuth.User, new CreateEmployeeRequest
        {
            FullName = "Ivan Lavrentiev",
            Phone = "+70000000004",
            Password = "employee123",
            Role = Roles.Employee,
            Position = "Business Analyst"
        }, cancellationToken);

        var adminAuth = await LoginAsync(new LoginRequest
        {
            Phone = admin.Phone,
            Password = "admin123"
        }, cancellationToken);

        var backendAuth = await LoginAsync(new LoginRequest
        {
            Phone = backendEngineer.Phone,
            Password = "employee123"
        }, cancellationToken);

        var analystAuth = await LoginAsync(new LoginRequest
        {
            Phone = analyst.Phone,
            Password = "employee123"
        }, cancellationToken);

        var coffeeIdea = await CreateIdeaAsync(backendAuth.User, new CreateIdeaRequest
        {
            Title = "Install a coffee machine",
            Description = "Employees spend too much time leaving the office for coffee. A shared coffee machine would be cheaper and faster."
        }, cancellationToken);

        await ModerateIdeaAsync(adminAuth.User, coffeeIdea.Id, new ModerateIdeaRequest
        {
            Approved = true,
            Comment = "The request is clearly written and can move to voting."
        }, cancellationToken);

        await VoteIdeaAsync(backendAuth.User, coffeeIdea.Id, new VoteIdeaRequest { Value = "for" }, cancellationToken);
        await VoteIdeaAsync(adminAuth.User, coffeeIdea.Id, new VoteIdeaRequest { Value = "for" }, cancellationToken);
        await MakeDirectorDecisionAsync(directorAuth.User, coffeeIdea.Id, new DirectorDecisionRequest
        {
            Approved = true,
            Comment = "Approved for the next office budget cycle."
        }, cancellationToken);

        var passIdea = await CreateIdeaAsync(analystAuth.User, new CreateIdeaRequest
        {
            Title = "Create a badge request app",
            Description = "Couriers and guests create too much manual work. A badge request app would save time for the office team."
        }, cancellationToken);

        await ModerateIdeaAsync(adminAuth.User, passIdea.Id, new ModerateIdeaRequest
        {
            Approved = true,
            Comment = "Good request, ready for company voting."
        }, cancellationToken);

        await VoteIdeaAsync(analystAuth.User, passIdea.Id, new VoteIdeaRequest { Value = "against" }, cancellationToken);
        await VoteIdeaAsync(adminAuth.User, passIdea.Id, new VoteIdeaRequest { Value = "against" }, cancellationToken);
        await VoteIdeaAsync(backendAuth.User, passIdea.Id, new VoteIdeaRequest { Value = "for" }, cancellationToken);

        var foodIdea = await CreateIdeaAsync(backendAuth.User, new CreateIdeaRequest
        {
            Title = "Free lunch support",
            Description = "A lunch stipend could reduce daily employee costs and improve satisfaction."
        }, cancellationToken);

        await ModerateIdeaAsync(adminAuth.User, foodIdea.Id, new ModerateIdeaRequest
        {
            Approved = true,
            Comment = "Text is fine, sending to voting."
        }, cancellationToken);

        await VoteIdeaAsync(backendAuth.User, foodIdea.Id, new VoteIdeaRequest { Value = "for" }, cancellationToken);
        await VoteIdeaAsync(adminAuth.User, foodIdea.Id, new VoteIdeaRequest { Value = "for" }, cancellationToken);
        await MakeDirectorDecisionAsync(directorAuth.User, foodIdea.Id, new DirectorDecisionRequest
        {
            Approved = false,
            Comment = "Rejected because the budget is not available this quarter."
        }, cancellationToken);

        var styleIdea = await CreateIdeaAsync(analystAuth.User, new CreateIdeaRequest
        {
            Title = "Rewrite request form copy",
            Description = "The text contains slang and should be rewritten before it can be published for voting."
        }, cancellationToken);

        await ModerateIdeaAsync(adminAuth.User, styleIdea.Id, new ModerateIdeaRequest
        {
            Approved = false,
            Comment = "Please rewrite the request in clear business language."
        }, cancellationToken);

        await CreateIdeaAsync(backendAuth.User, new CreateIdeaRequest
        {
            Title = "Buy PlayStation 5 for the rest area",
            Description = "A shared console in the break area could improve morale and be used during internal events."
        }, cancellationToken);
    }

    private CompanyDto SanitizeCompany(Company company)
    {
        return new CompanyDto
        {
            Id = company.Id,
            Name = company.Name,
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
            Phone = user.Phone,
            Role = user.Role,
            Position = user.Position,
            AvatarUrl = user.AvatarUrl,
            IsActive = user.IsActive,
            CreatedAt = user.CreatedAt
        };
    }

    private static void CleanupExpiredSessions(AppState state, string nowIso)
    {
        var now = DateTimeOffset.Parse(nowIso);
        state.Sessions = state.Sessions
            .Where(session => DateTimeOffset.Parse(session.ExpiresAt) > now)
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
        var votes = state.Votes.Where(vote => vote.IdeaId == idea.Id).ToList();
        var support = votes.Count(vote => vote.Value == "for");
        var against = votes.Count - support;
        var eligibleVoters = idea.VotingEligibleUserIds.Count;
        var approvalPercent = eligibleVoters > 0
            ? (int)Math.Round((double)support / eligibleVoters * 100, MidpointRounding.AwayFromZero)
            : 0;

        return new VoteSummaryDto
        {
            Support = support,
            Against = against,
            Total = votes.Count,
            EligibleVoters = eligibleVoters,
            RemainingVotes = Math.Max(eligibleVoters - votes.Count, 0),
            ApprovalPercent = approvalPercent,
            ThresholdPercent = BusinessRules.VoteApprovalPercent,
            Passed = approvalPercent > BusinessRules.VoteApprovalPercent
        };
    }

    private IdeaDto BuildIdeaDto(AppState state, Idea idea, UserDto? viewer)
    {
        var author = state.Users.FirstOrDefault(user => user.Id == idea.AuthorId);
        var moderator = string.IsNullOrWhiteSpace(idea.ModeratedBy)
            ? null
            : state.Users.FirstOrDefault(user => user.Id == idea.ModeratedBy);
        var director = string.IsNullOrWhiteSpace(idea.DirectorDecisionBy)
            ? null
            : state.Users.FirstOrDefault(user => user.Id == idea.DirectorDecisionBy);
        var viewerVote = viewer is null
            ? null
            : state.Votes.FirstOrDefault(vote => vote.IdeaId == idea.Id && vote.UserId == viewer.Id);
        var votes = GetVoteSummary(state, idea);

        return new IdeaDto
        {
            Id = idea.Id,
            CompanyId = idea.CompanyId,
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
                : BuildAvailableActions(state, idea, viewer)
        };
    }

    private static IdeaAvailableActionsDto BuildAvailableActions(AppState state, Idea idea, UserDto viewer)
    {
        var viewerVote = state.Votes.FirstOrDefault(vote => vote.IdeaId == idea.Id && vote.UserId == viewer.Id);

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
        var ideas = state.Ideas.Where(idea => idea.CompanyId == companyId).ToList();
        var activeEmployees = state.Users.Where(user => user.CompanyId == companyId && user.IsActive).ToList();

        return new CompanyStatsDto
        {
            Employees = activeEmployees.Count,
            Ideas = new CompanyIdeaStatsDto
            {
                Total = ideas.Count,
                Active = ideas.Count(idea => BusinessRules.ActiveIdeaStatuses.Contains(idea.Status)),
                Archive = ideas.Count(idea => BusinessRules.ArchiveIdeaStatuses.Contains(idea.Status)),
                PendingModeration = ideas.Count(idea => idea.Status == IdeaStatuses.PendingModeration),
                WaitingForDirector = ideas.Count(idea => idea.Status == IdeaStatuses.DirectorReview)
            }
        };
    }

    private Session CreateSession(AppState state, string userId, string nowIso)
    {
        var expiresAt = DateTimeOffset.Parse(nowIso).AddHours(_options.SessionTtlHours).ToString("O");
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
        if (state.Users.Any(user => user.Phone == phone))
        {
            throw new AppException(StatusCodes.Status409Conflict, "CONFLICT", "A user with this phone number already exists");
        }
    }

    private static void AssertRoleCanBeCreated(string role)
    {
        if (role is not (Roles.Admin or Roles.Employee))
        {
            throw new AppException(StatusCodes.Status400BadRequest, "BAD_REQUEST", "role must be one of: admin, employee");
        }
    }

    private static bool IsIdeaCreatedInSameUtcMonth(string ideaCreatedAt, string nowIso)
    {
        var current = DateTimeOffset.Parse(nowIso).UtcDateTime;
        var created = DateTimeOffset.Parse(ideaCreatedAt).UtcDateTime;
        return current.Year == created.Year && current.Month == created.Month;
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
}
