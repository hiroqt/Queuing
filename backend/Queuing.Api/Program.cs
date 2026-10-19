using Queuing.Core;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:5173").AllowAnyHeader().AllowAnyMethod();
    });
});

builder.Services.AddControllers();
builder.Services.AddProblemDetails();
builder.Services.AddSingleton<QueueDemoStore>();

var app = builder.Build();

app.UseCors();
app.UseExceptionHandler();
app.UseStatusCodePages();

//app.MapGet("/", () => "Hello World!");
//app.MapGet("/test", () => "Hello World!");

app.MapControllers();

app.Run();
