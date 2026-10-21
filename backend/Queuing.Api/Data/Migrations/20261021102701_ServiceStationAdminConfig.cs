using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Queuing.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class ServiceStationAdminConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Services",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false),
                    DepartmentId = table.Column<Guid>(type: "char(36)", nullable: false),
                    Name = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false),
                    Active = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetime", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Services", x => x.Id);
                    table.UniqueConstraint("AK_Services_DepartmentId_Id", x => new { x.DepartmentId, x.Id });
                    table.ForeignKey(
                        name: "FK_Services_Departments_DepartmentId",
                        column: x => x.DepartmentId,
                        principalTable: "Departments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "Stations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false),
                    DepartmentId = table.Column<Guid>(type: "char(36)", nullable: false),
                    Name = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false),
                    Active = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetime", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Stations", x => x.Id);
                    table.UniqueConstraint("AK_Stations_DepartmentId_Id", x => new { x.DepartmentId, x.Id });
                    table.ForeignKey(
                        name: "FK_Stations_Departments_DepartmentId",
                        column: x => x.DepartmentId,
                        principalTable: "Departments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "StationServices",
                columns: table => new
                {
                    DepartmentId = table.Column<Guid>(type: "char(36)", nullable: false),
                    StationId = table.Column<Guid>(type: "char(36)", nullable: false),
                    ServiceId = table.Column<Guid>(type: "char(36)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StationServices", x => new { x.DepartmentId, x.StationId, x.ServiceId });
                    table.ForeignKey(
                        name: "FK_StationServices_Services_DepartmentId_ServiceId",
                        columns: x => new { x.DepartmentId, x.ServiceId },
                        principalTable: "Services",
                        principalColumns: new[] { "DepartmentId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StationServices_Stations_DepartmentId_StationId",
                        columns: x => new { x.DepartmentId, x.StationId },
                        principalTable: "Stations",
                        principalColumns: new[] { "DepartmentId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "StationStaff",
                columns: table => new
                {
                    DepartmentId = table.Column<Guid>(type: "char(36)", nullable: false),
                    StationId = table.Column<Guid>(type: "char(36)", nullable: false),
                    UserId = table.Column<Guid>(type: "char(36)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StationStaff", x => new { x.DepartmentId, x.StationId, x.UserId });
                    table.ForeignKey(
                        name: "FK_StationStaff_Stations_DepartmentId_StationId",
                        columns: x => new { x.DepartmentId, x.StationId },
                        principalTable: "Stations",
                        principalColumns: new[] { "DepartmentId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StationStaff_UserDepartments_UserId_DepartmentId",
                        columns: x => new { x.UserId, x.DepartmentId },
                        principalTable: "UserDepartments",
                        principalColumns: new[] { "UserId", "DepartmentId" },
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_Services_DepartmentId_Name",
                table: "Services",
                columns: new[] { "DepartmentId", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Stations_DepartmentId_Name",
                table: "Stations",
                columns: new[] { "DepartmentId", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StationServices_DepartmentId_ServiceId",
                table: "StationServices",
                columns: new[] { "DepartmentId", "ServiceId" });

            migrationBuilder.CreateIndex(
                name: "IX_StationStaff_UserId_DepartmentId",
                table: "StationStaff",
                columns: new[] { "UserId", "DepartmentId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StationServices");

            migrationBuilder.DropTable(
                name: "StationStaff");

            migrationBuilder.DropTable(
                name: "Services");

            migrationBuilder.DropTable(
                name: "Stations");
        }
    }
}
