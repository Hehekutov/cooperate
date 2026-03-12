namespace Backend.Domain;

public sealed class RegisterCompanyRequest
{
    public string? CompanyName { get; set; }

    public string? CompanyDescription { get; set; }

    public string? DirectorName { get; set; }

    public string? DirectorPosition { get; set; }

    public string? Phone { get; set; }

    public string? Password { get; set; }

    public string? AvatarUrl { get; set; }
}

public sealed class LoginRequest
{
    public string? Phone { get; set; }

    public string? Password { get; set; }
}

public sealed class CreateEmployeeRequest
{
    public string? FullName { get; set; }

    public string? Phone { get; set; }

    public string? Password { get; set; }

    public string? Role { get; set; }

    public string? Position { get; set; }

    public string? AvatarUrl { get; set; }
}

public sealed class CreateIdeaRequest
{
    public string? Title { get; set; }

    public string? Description { get; set; }
}

public sealed class ModerateIdeaRequest
{
    public bool Approved { get; set; }

    public string? Comment { get; set; }
}

public sealed class VoteIdeaRequest
{
    public string? Value { get; set; }
}

public sealed class DirectorDecisionRequest
{
    public bool Approved { get; set; }

    public string? Comment { get; set; }
}

public sealed class IdeaListQuery
{
    public string? Scope { get; set; }

    public string? Status { get; set; }

    public string? Q { get; set; }

    public int? Limit { get; set; }

    public string? Sort { get; set; }
}

public sealed class CompanyDto
{
    public string Id { get; init; } = string.Empty;

    public string Name { get; init; } = string.Empty;

    public string? Description { get; init; }

    public string CreatedAt { get; init; } = string.Empty;

    public CompanySettings Settings { get; init; } = new();
}

public sealed class UserDto
{
    public string Id { get; init; } = string.Empty;

    public string CompanyId { get; init; } = string.Empty;

    public string FullName { get; init; } = string.Empty;

    public string Phone { get; init; } = string.Empty;

    public string Role { get; init; } = string.Empty;

    public string Position { get; init; } = string.Empty;

    public string? AvatarUrl { get; init; }

    public bool IsActive { get; init; }

    public string CreatedAt { get; init; } = string.Empty;
}

public sealed class AuthResponse
{
    public string Token { get; init; } = string.Empty;

    public string ExpiresAt { get; init; } = string.Empty;

    public CompanyDto Company { get; init; } = new();

    public UserDto User { get; init; } = new();
}

public sealed class RequestAuthContext
{
    public string Token { get; init; } = string.Empty;

    public CompanyDto Company { get; init; } = new();

    public UserDto User { get; init; } = new();
}

public sealed class CompanyIdeaStatsDto
{
    public int Total { get; init; }

    public int Active { get; init; }

    public int Archive { get; init; }

    public int PendingModeration { get; init; }

    public int WaitingForDirector { get; init; }
}

public sealed class CompanyStatsDto
{
    public int Employees { get; init; }

    public CompanyIdeaStatsDto Ideas { get; init; } = new();
}

public sealed class CompanyOverviewDto
{
    public CompanyDto Company { get; init; } = new();

    public UserDto CurrentUser { get; init; } = new();

    public CompanyStatsDto Stats { get; init; } = new();
}

public sealed class EmployeeListDto
{
    public IReadOnlyList<UserDto> Items { get; init; } = [];

    public int Total { get; init; }
}

public sealed class VoteSummaryDto
{
    public int Support { get; init; }

    public int Against { get; init; }

    public int Total { get; init; }

    public int EligibleVoters { get; init; }

    public int RemainingVotes { get; init; }

    public int ApprovalPercent { get; init; }

    public int ThresholdPercent { get; init; }

    public bool Passed { get; init; }
}

public sealed class IdeaModerationDto
{
    public UserDto? ReviewedBy { get; init; }

    public string? Comment { get; init; }

    public string? ReviewedAt { get; init; }
}

public sealed class ViewerVoteDto
{
    public string Value { get; init; } = string.Empty;

    public string CreatedAt { get; init; } = string.Empty;
}

public sealed class DirectorDecisionDto
{
    public UserDto? DecidedBy { get; init; }

    public string? Comment { get; init; }

    public string? DecidedAt { get; init; }

    public bool? Approved { get; init; }
}

public sealed class IdeaTimelineDto
{
    public string CreatedAt { get; init; } = string.Empty;

    public string UpdatedAt { get; init; } = string.Empty;

    public string? ModeratedAt { get; init; }

    public string? VotingOpenedAt { get; init; }

    public string? VotingClosedAt { get; init; }

    public string? DirectorReviewRequestedAt { get; init; }

    public string? DirectorDecisionAt { get; init; }

    public string? ArchivedAt { get; init; }
}

public sealed class IdeaAvailableActionsDto
{
    public bool CanModerate { get; init; }

    public bool CanVote { get; init; }

    public bool CanMakeDirectorDecision { get; init; }
}

public sealed class IdeaDto
{
    public string Id { get; init; } = string.Empty;

    public string CompanyId { get; init; } = string.Empty;

    public string Title { get; init; } = string.Empty;

    public string Description { get; init; } = string.Empty;

    public string DescriptionPreview { get; init; } = string.Empty;

    public string Status { get; init; } = string.Empty;

    public string Scope { get; init; } = string.Empty;

    public bool Archived { get; init; }

    public UserDto? Author { get; init; }

    public IdeaModerationDto Moderation { get; init; } = new();

    public VoteSummaryDto Votes { get; init; } = new();

    public ViewerVoteDto? ViewerVote { get; init; }

    public DirectorDecisionDto DirectorDecision { get; init; } = new();

    public IdeaTimelineDto Timeline { get; init; } = new();

    public IdeaAvailableActionsDto AvailableActions { get; init; } = new();
}

public sealed class IdeaListDto
{
    public IReadOnlyList<IdeaDto> Items { get; init; } = [];

    public int Total { get; init; }
}
