using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Queuing.Api.Data;

namespace Queuing.Api.Auth;

public static class AdminBootstrapper
{
    public static async Task RunAsync(IServiceProvider services, IConfiguration configuration)
    {
        var userName = configuration["BootstrapAdmin:UserName"];
        var password = configuration["BootstrapAdmin:Password"];
        if (string.IsNullOrWhiteSpace(userName) || string.IsNullOrWhiteSpace(password))
        {
            throw new InvalidOperationException("Set BootstrapAdmin__UserName and BootstrapAdmin__Password for this one-time command.");
        }

        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<QueueDbContext>();
        await db.Database.MigrateAsync();
        if (await db.Users.AnyAsync(user => user.UserName == userName))
        {
            throw new InvalidOperationException("That bootstrap user already exists. Bootstrap does not reset accounts.");
        }

        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<QueueUser>>();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
        foreach (var role in new[] { QueueRoles.Admin, QueueRoles.Reception, QueueRoles.Staff })
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                var roleResult = await roleManager.CreateAsync(new IdentityRole<Guid>(role));
                EnsureSucceeded(roleResult);
            }
        }

        if (!await db.Departments.AnyAsync())
        {
            db.Departments.AddRange(
                new Department { Name = "X-ray" },
                new Department { Name = "Animal Bite Center" },
                new Department { Name = "ECG" });
            await db.SaveChangesAsync();
        }

        var admin = new QueueUser
        {
            UserName = userName,
            DisplayName = userName,
            MustChangePassword = false
        };
        EnsureSucceeded(await userManager.CreateAsync(admin, password));
        EnsureSucceeded(await userManager.AddToRoleAsync(admin, QueueRoles.Admin));
        Console.WriteLine($"Created initial administrator '{userName}'. Remove bootstrap secrets from the environment now.");
    }

    private static void EnsureSucceeded(IdentityResult result)
    {
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(string.Join("; ", result.Errors.Select(error => error.Description)));
        }
    }
}
