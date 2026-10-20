using Queuing.Api.Hubs;
using Queuing.Core;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:4173",
            "http://127.0.0.1:4173")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

builder.Services.AddControllers();
builder.Services.AddProblemDetails();
builder.Services.AddSignalR();
builder.Services.AddSingleton<QueueDemoStore>();

var app = builder.Build();

app.UseCors();
app.UseExceptionHandler();
app.UseStatusCodePages();

app.MapControllers();
app.MapHub<QueueHub>("/hubs/queue");

app.Run();
