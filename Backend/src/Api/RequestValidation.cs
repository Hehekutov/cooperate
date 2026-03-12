using System.Text.Json;
using Backend.Domain;
using Backend.Services;

namespace Backend.Api;

internal static class RequestValidation
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly HashSet<string> IdeaListQueryKeys =
    [
        "scope",
        "status",
        "q",
        "limit",
        "sort"
    ];
    private static readonly HashSet<string> IdeaScopes =
    [
        "active",
        "archive",
        "mine",
        "moderation",
        "director_review",
        "all"
    ];
    private static readonly HashSet<string> IdeaStatuses =
    [
        Domain.IdeaStatuses.PendingModeration,
        Domain.IdeaStatuses.Voting,
        Domain.IdeaStatuses.DirectorReview,
        Domain.IdeaStatuses.RejectedByAdmin,
        Domain.IdeaStatuses.RejectedByVote,
        Domain.IdeaStatuses.ApprovedByDirector,
        Domain.IdeaStatuses.RejectedByDirector
    ];
    private static readonly HashSet<string> IdeaSorts =
    [
        "recent",
        "support"
    ];
    private static readonly JsonObjectSchema RegisterCompanySchema = new(
        new Dictionary<string, JsonPropertyRule>(StringComparer.Ordinal)
        {
            ["companyName"] = JsonPropertyRule.String(required: true, minLength: 1, maxLength: 120),
            ["companyDescription"] = JsonPropertyRule.String(maxLength: 500),
            ["directorName"] = JsonPropertyRule.String(required: true, minLength: 1, maxLength: 120),
            ["directorPosition"] = JsonPropertyRule.String(maxLength: 120),
            ["phone"] = JsonPropertyRule.String(required: true, minLength: 10, maxLength: 30),
            ["password"] = JsonPropertyRule.String(required: true, minLength: 6, maxLength: 128),
            ["avatarUrl"] = JsonPropertyRule.String(maxLength: 500)
        });
    private static readonly JsonObjectSchema LoginSchema = new(
        new Dictionary<string, JsonPropertyRule>(StringComparer.Ordinal)
        {
            ["phone"] = JsonPropertyRule.String(required: true, minLength: 10, maxLength: 30),
            ["password"] = JsonPropertyRule.String(required: true, minLength: 6, maxLength: 128)
        });
    private static readonly JsonObjectSchema CreateEmployeeSchema = new(
        new Dictionary<string, JsonPropertyRule>(StringComparer.Ordinal)
        {
            ["fullName"] = JsonPropertyRule.String(required: true, minLength: 1, maxLength: 120),
            ["phone"] = JsonPropertyRule.String(required: true, minLength: 10, maxLength: 30),
            ["password"] = JsonPropertyRule.String(required: true, minLength: 6, maxLength: 128),
            ["role"] = JsonPropertyRule.String(required: true, allowedValues: [Roles.Admin, Roles.Employee]),
            ["position"] = JsonPropertyRule.String(maxLength: 120),
            ["avatarUrl"] = JsonPropertyRule.String(maxLength: 500)
        });
    private static readonly JsonObjectSchema CreateIdeaSchema = new(
        new Dictionary<string, JsonPropertyRule>(StringComparer.Ordinal)
        {
            ["title"] = JsonPropertyRule.String(required: true, minLength: 1, maxLength: 160),
            ["description"] = JsonPropertyRule.String(required: true, minLength: 1, maxLength: 3000)
        });
    private static readonly JsonObjectSchema ModerateIdeaSchema = new(
        new Dictionary<string, JsonPropertyRule>(StringComparer.Ordinal)
        {
            ["approved"] = JsonPropertyRule.Boolean(required: true),
            ["comment"] = JsonPropertyRule.String(maxLength: 1000)
        });
    private static readonly JsonObjectSchema VoteIdeaSchema = new(
        new Dictionary<string, JsonPropertyRule>(StringComparer.Ordinal)
        {
            ["value"] = JsonPropertyRule.String(required: true, allowedValues: ["for", "against"])
        });
    private static readonly JsonObjectSchema DirectorDecisionSchema = new(
        new Dictionary<string, JsonPropertyRule>(StringComparer.Ordinal)
        {
            ["approved"] = JsonPropertyRule.Boolean(required: true),
            ["comment"] = JsonPropertyRule.String(maxLength: 1000)
        });

    public static Task<RegisterCompanyRequest> ReadRegisterCompanyAsync(HttpRequest request, CancellationToken cancellationToken)
        => ReadBodyAsync<RegisterCompanyRequest>(request, RegisterCompanySchema, cancellationToken);

    public static Task<LoginRequest> ReadLoginAsync(HttpRequest request, CancellationToken cancellationToken)
        => ReadBodyAsync<LoginRequest>(request, LoginSchema, cancellationToken);

    public static Task<CreateEmployeeRequest> ReadCreateEmployeeAsync(HttpRequest request, CancellationToken cancellationToken)
        => ReadBodyAsync<CreateEmployeeRequest>(request, CreateEmployeeSchema, cancellationToken);

    public static Task<CreateIdeaRequest> ReadCreateIdeaAsync(HttpRequest request, CancellationToken cancellationToken)
        => ReadBodyAsync<CreateIdeaRequest>(request, CreateIdeaSchema, cancellationToken);

    public static Task<ModerateIdeaRequest> ReadModerateIdeaAsync(HttpRequest request, CancellationToken cancellationToken)
        => ReadBodyAsync<ModerateIdeaRequest>(request, ModerateIdeaSchema, cancellationToken);

    public static Task<VoteIdeaRequest> ReadVoteIdeaAsync(HttpRequest request, CancellationToken cancellationToken)
        => ReadBodyAsync<VoteIdeaRequest>(request, VoteIdeaSchema, cancellationToken);

    public static Task<DirectorDecisionRequest> ReadDirectorDecisionAsync(HttpRequest request, CancellationToken cancellationToken)
        => ReadBodyAsync<DirectorDecisionRequest>(request, DirectorDecisionSchema, cancellationToken);

    public static IdeaListQuery ReadIdeaListQuery(IQueryCollection query)
    {
        var errors = new List<ValidationIssue>();

        foreach (var key in query.Keys)
        {
            if (!IdeaListQueryKeys.Contains(key))
            {
                errors.Add(new ValidationIssue($"querystring/{key}", "must NOT have additional properties"));
            }
        }

        var scope = ReadOptionalQueryString(query, "scope", errors, allowedValues: IdeaScopes);
        var status = ReadOptionalQueryString(query, "status", errors, allowedValues: IdeaStatuses);
        var q = ReadOptionalQueryString(query, "q", errors, maxLength: 120);
        var sort = ReadOptionalQueryString(query, "sort", errors, allowedValues: IdeaSorts);
        var limit = ReadOptionalQueryInteger(query, "limit", errors, minimum: 1, maximum: 100);

        if (errors.Count > 0)
        {
            throw CreateValidationException(errors);
        }

        return new IdeaListQuery
        {
            Scope = scope,
            Status = status,
            Q = q,
            Sort = sort,
            Limit = limit
        };
    }

    private static async Task<T> ReadBodyAsync<T>(HttpRequest request, JsonObjectSchema schema, CancellationToken cancellationToken)
    {
        JsonDocument document;

        try
        {
            document = await JsonDocument.ParseAsync(request.Body, cancellationToken: cancellationToken);
        }
        catch (JsonException)
        {
            throw CreateValidationException(
                [new ValidationIssue("body", "must be valid JSON")],
                "Request body must be valid JSON");
        }

        using (document)
        {
            if (document.RootElement.ValueKind != JsonValueKind.Object)
            {
                throw CreateValidationException(
                    [new ValidationIssue("body", "must be a JSON object")],
                    "Request body must be a JSON object");
            }

            var errors = ValidateObject(document.RootElement, schema);

            if (errors.Count > 0)
            {
                throw CreateValidationException(errors);
            }

            var result = document.RootElement.Deserialize<T>(JsonOptions);

            return result
                ?? throw CreateValidationException(
                    [new ValidationIssue("body", "could not be deserialized")],
                    "Request body could not be deserialized");
        }
    }

    private static List<ValidationIssue> ValidateObject(JsonElement root, JsonObjectSchema schema)
    {
        var errors = new List<ValidationIssue>();
        var seen = new HashSet<string>(StringComparer.Ordinal);

        foreach (var property in root.EnumerateObject())
        {
            seen.Add(property.Name);

            if (!schema.Properties.TryGetValue(property.Name, out var rule))
            {
                errors.Add(new ValidationIssue($"body/{property.Name}", "must NOT have additional properties"));
                continue;
            }

            ValidateProperty(property.Name, property.Value, rule, errors);
        }

        foreach (var (name, rule) in schema.Properties)
        {
            if (rule.Required && !seen.Contains(name))
            {
                errors.Add(new ValidationIssue($"body/{name}", "is required"));
            }
        }

        return errors;
    }

    private static void ValidateProperty(string name, JsonElement value, JsonPropertyRule rule, List<ValidationIssue> errors)
    {
        var path = $"body/{name}";

        switch (rule.Kind)
        {
            case JsonPropertyKind.String:
            {
                if (value.ValueKind != JsonValueKind.String)
                {
                    errors.Add(new ValidationIssue(path, "must be a string"));
                    return;
                }

                var text = value.GetString() ?? string.Empty;

                if (rule.MinLength is int minLength && text.Length < minLength)
                {
                    errors.Add(new ValidationIssue(path, $"must be at least {minLength} characters"));
                }

                if (rule.MaxLength is int maxLength && text.Length > maxLength)
                {
                    errors.Add(new ValidationIssue(path, $"must be at most {maxLength} characters"));
                }

                if (rule.AllowedValues is not null && !rule.AllowedValues.Contains(text))
                {
                    errors.Add(new ValidationIssue(path, $"must be one of: {string.Join(", ", rule.AllowedValues)}"));
                }

                break;
            }
            case JsonPropertyKind.Boolean:
            {
                if (value.ValueKind is not (JsonValueKind.True or JsonValueKind.False))
                {
                    errors.Add(new ValidationIssue(path, "must be a boolean"));
                }

                break;
            }
            case JsonPropertyKind.Integer:
            {
                if (!value.TryGetInt32(out var parsed))
                {
                    errors.Add(new ValidationIssue(path, "must be an integer"));
                    return;
                }

                if (rule.Minimum is int minimum && parsed < minimum)
                {
                    errors.Add(new ValidationIssue(path, $"must be >= {minimum}"));
                }

                if (rule.Maximum is int maximum && parsed > maximum)
                {
                    errors.Add(new ValidationIssue(path, $"must be <= {maximum}"));
                }

                break;
            }
        }
    }

    private static string? ReadOptionalQueryString(
        IQueryCollection query,
        string name,
        List<ValidationIssue> errors,
        int? maxLength = null,
        HashSet<string>? allowedValues = null)
    {
        if (!query.TryGetValue(name, out var rawValue))
        {
            return null;
        }

        var value = rawValue.ToString();

        if (maxLength is int max && value.Length > max)
        {
            errors.Add(new ValidationIssue($"querystring/{name}", $"must be at most {max} characters"));
        }

        if (allowedValues is not null && !allowedValues.Contains(value))
        {
            errors.Add(new ValidationIssue($"querystring/{name}", $"must be one of: {string.Join(", ", allowedValues)}"));
        }

        return value;
    }

    private static int? ReadOptionalQueryInteger(
        IQueryCollection query,
        string name,
        List<ValidationIssue> errors,
        int minimum,
        int maximum)
    {
        if (!query.TryGetValue(name, out var rawValue))
        {
            return null;
        }

        var value = rawValue.ToString();

        if (!int.TryParse(value, out var parsed))
        {
            errors.Add(new ValidationIssue($"querystring/{name}", "must be an integer"));
            return null;
        }

        if (parsed < minimum)
        {
            errors.Add(new ValidationIssue($"querystring/{name}", $"must be >= {minimum}"));
        }

        if (parsed > maximum)
        {
            errors.Add(new ValidationIssue($"querystring/{name}", $"must be <= {maximum}"));
        }

        return parsed;
    }

    private static AppException CreateValidationException(
        IReadOnlyList<ValidationIssue> issues,
        string? message = null)
    {
        var details = issues
            .Select(issue => new
            {
                field = issue.Path,
                message = issue.Message
            })
            .ToArray();

        return new AppException(
            StatusCodes.Status400BadRequest,
            "VALIDATION_ERROR",
            message ?? $"{issues[0].Path} {issues[0].Message}",
            details);
    }

    private sealed class JsonObjectSchema
    {
        public JsonObjectSchema(IReadOnlyDictionary<string, JsonPropertyRule> properties)
        {
            Properties = properties;
        }

        public IReadOnlyDictionary<string, JsonPropertyRule> Properties { get; }
    }

    private sealed class JsonPropertyRule
    {
        public required JsonPropertyKind Kind { get; init; }

        public bool Required { get; init; }

        public int? MinLength { get; init; }

        public int? MaxLength { get; init; }

        public int? Minimum { get; init; }

        public int? Maximum { get; init; }

        public HashSet<string>? AllowedValues { get; init; }

        public static JsonPropertyRule String(
            bool required = false,
            int? minLength = null,
            int? maxLength = null,
            IEnumerable<string>? allowedValues = null)
        {
            return new JsonPropertyRule
            {
                Kind = JsonPropertyKind.String,
                Required = required,
                MinLength = minLength,
                MaxLength = maxLength,
                AllowedValues = allowedValues is null
                    ? null
                    : new HashSet<string>(allowedValues, StringComparer.Ordinal)
            };
        }

        public static JsonPropertyRule Boolean(bool required = false)
        {
            return new JsonPropertyRule
            {
                Kind = JsonPropertyKind.Boolean,
                Required = required
            };
        }

        public static JsonPropertyRule Integer(bool required = false, int? minimum = null, int? maximum = null)
        {
            return new JsonPropertyRule
            {
                Kind = JsonPropertyKind.Integer,
                Required = required,
                Minimum = minimum,
                Maximum = maximum
            };
        }
    }

    private enum JsonPropertyKind
    {
        String,
        Boolean,
        Integer
    }

    private sealed record ValidationIssue(string Path, string Message);
}
