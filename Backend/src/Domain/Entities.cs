namespace Backend.Domain;

public sealed class AppState
{
    public List<Company> Companies { get; set; } = [];

    public List<UserAccount> Users { get; set; } = [];

    public List<Idea> Ideas { get; set; } = [];

    public List<IdeaVote> Votes { get; set; } = [];

    public List<Session> Sessions { get; set; } = [];

    public static AppState CreateInitial() => new();
}

public sealed class Company
{
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string CreatedAt { get; set; } = string.Empty;

    public CompanySettings Settings { get; set; } = new();
}

public sealed class CompanySettings
{
    public int IdeaMonthlyLimit { get; set; }

    public int VoteApprovalPercent { get; set; }
}

public sealed class UserAccount
{
    public string Id { get; set; } = string.Empty;

    public string CompanyId { get; set; } = string.Empty;

    public string FullName { get; set; } = string.Empty;

    public string Phone { get; set; } = string.Empty;

    public string Role { get; set; } = string.Empty;

    public string Position { get; set; } = string.Empty;

    public string? AvatarUrl { get; set; }

    public string PasswordHash { get; set; } = string.Empty;

    public bool IsActive { get; set; }

    public string CreatedAt { get; set; } = string.Empty;
}

public sealed class Idea
{
    public string Id { get; set; } = string.Empty;

    public string CompanyId { get; set; } = string.Empty;

    public string AuthorId { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string? ModerationComment { get; set; }

    public string? ModeratedAt { get; set; }

    public string? ModeratedBy { get; set; }

    public List<string> VotingEligibleUserIds { get; set; } = [];

    public string? VotingOpenedAt { get; set; }

    public string? VotingClosedAt { get; set; }

    public string? DirectorReviewRequestedAt { get; set; }

    public string? DirectorDecisionAt { get; set; }

    public string? DirectorDecisionBy { get; set; }

    public string? DirectorComment { get; set; }

    public string? ArchivedAt { get; set; }

    public string CreatedAt { get; set; } = string.Empty;

    public string UpdatedAt { get; set; } = string.Empty;
}

public sealed class IdeaVote
{
    public string Id { get; set; } = string.Empty;

    public string IdeaId { get; set; } = string.Empty;

    public string UserId { get; set; } = string.Empty;

    public string Value { get; set; } = string.Empty;

    public string CreatedAt { get; set; } = string.Empty;
}

public sealed class Session
{
    public string Id { get; set; } = string.Empty;

    public string UserId { get; set; } = string.Empty;

    public string Token { get; set; } = string.Empty;

    public string CreatedAt { get; set; } = string.Empty;

    public string ExpiresAt { get; set; } = string.Empty;
}
