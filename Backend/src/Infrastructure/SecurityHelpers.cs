using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Backend.Services;

namespace Backend.Infrastructure;

public static partial class SecurityHelpers
{
    public static string CreateId(string prefix) => $"{prefix}_{Guid.NewGuid():D}";

    public static string GenerateToken()
    {
        Span<byte> buffer = stackalloc byte[32];
        RandomNumberGenerator.Fill(buffer);
        return Convert.ToHexString(buffer).ToLowerInvariant();
    }

    public static string NormalizePhone(string? phone)
    {
        var digits = DigitsPattern().Replace(phone ?? string.Empty, string.Empty);

        if (digits.Length < 10)
        {
            throw new AppException(StatusCodes.Status400BadRequest, "BAD_REQUEST", "Phone number must contain at least 10 digits");
        }

        return $"+{digits}";
    }

    public static string HashPassword(string? password)
    {
        var normalized = password ?? string.Empty;

        if (normalized.Length < 6)
        {
            throw new AppException(StatusCodes.Status400BadRequest, "BAD_REQUEST", "Password must contain at least 6 characters");
        }

        Span<byte> salt = stackalloc byte[16];
        RandomNumberGenerator.Fill(salt);
        Span<byte> hash = stackalloc byte[32];
        Rfc2898DeriveBytes.Pbkdf2(normalized, salt, hash, 100_000, HashAlgorithmName.SHA256);

        return $"{Convert.ToHexString(salt)}:{Convert.ToHexString(hash)}";
    }

    public static bool VerifyPassword(string? password, string? storedHash)
    {
        if (string.IsNullOrWhiteSpace(storedHash))
        {
            return false;
        }

        var parts = storedHash.Split(':', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        if (parts.Length != 2)
        {
            return false;
        }

        var salt = Convert.FromHexString(parts[0]);
        var original = Convert.FromHexString(parts[1]);
        var candidate = Rfc2898DeriveBytes.Pbkdf2(password ?? string.Empty, salt, 100_000, HashAlgorithmName.SHA256, original.Length);

        return CryptographicOperations.FixedTimeEquals(candidate, original);
    }

    [GeneratedRegex(@"\D")]
    private static partial Regex DigitsPattern();
}
