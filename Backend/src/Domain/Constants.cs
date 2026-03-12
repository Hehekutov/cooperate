namespace Backend.Domain;

public static class Roles
{
    public const string Director = "director";
    public const string Admin = "admin";
    public const string Employee = "employee";
}

public static class IdeaStatuses
{
    public const string PendingModeration = "pending_moderation";
    public const string Voting = "voting";
    public const string DirectorReview = "director_review";
    public const string RejectedByAdmin = "rejected_by_admin";
    public const string RejectedByVote = "rejected_by_vote";
    public const string ApprovedByDirector = "approved_by_director";
    public const string RejectedByDirector = "rejected_by_director";
}

public static class BusinessRules
{
    public const int VoteApprovalPercent = 50;

    public static readonly HashSet<string> ActiveIdeaStatuses =
    [
        IdeaStatuses.PendingModeration,
        IdeaStatuses.Voting,
        IdeaStatuses.DirectorReview
    ];

    public static readonly HashSet<string> ArchiveIdeaStatuses =
    [
        IdeaStatuses.RejectedByAdmin,
        IdeaStatuses.RejectedByVote,
        IdeaStatuses.ApprovedByDirector,
        IdeaStatuses.RejectedByDirector
    ];
}
