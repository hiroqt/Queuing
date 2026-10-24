using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Queuing.Api.Data.Migrations
{
    public partial class LobbyDisplayAndVideos : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Guid>(
                name: "DepartmentId",
                table: "DisplayDevices",
                type: "char(36)",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "char(36)");

            migrationBuilder.CreateTable(
                name: "DisplayVideos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false),
                    Name = table.Column<string>(type: "varchar(160)", maxLength: 160, nullable: false),
                    Url = table.Column<string>(type: "varchar(2048)", maxLength: 2048, nullable: true),
                    StorageKey = table.Column<string>(type: "varchar(80)", maxLength: 80, nullable: true),
                    ContentType = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetime", nullable: false)
                },
                constraints: table => table.PrimaryKey("PK_DisplayVideos", video => video.Id))
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_DisplayVideos_CreatedAtUtc_Id",
                table: "DisplayVideos",
                columns: new[] { "CreatedAtUtc", "Id" });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            throw new NotSupportedException("Remove all lobby display devices and retain or remove display videos before restoring the prior required department assignment. Back up display media before rollback.");
        }
    }
}
