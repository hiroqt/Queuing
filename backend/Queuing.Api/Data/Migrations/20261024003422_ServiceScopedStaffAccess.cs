using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Queuing.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class ServiceScopedStaffAccess : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserServices",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "char(36)", nullable: false),
                    ServiceId = table.Column<Guid>(type: "char(36)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserServices", x => new { x.UserId, x.ServiceId });
                    table.ForeignKey(
                        name: "FK_UserServices_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserServices_Services_ServiceId",
                        column: x => x.ServiceId,
                        principalTable: "Services",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_UserServices_ServiceId",
                table: "UserServices",
                column: "ServiceId");

            migrationBuilder.Sql("""
                INSERT INTO `UserServices` (`UserId`, `ServiceId`)
                SELECT DISTINCT `assignment`.`UserId`, `service`.`Id`
                FROM `UserDepartments` AS `assignment`
                INNER JOIN `AspNetUserRoles` AS `userRole` ON `userRole`.`UserId` = `assignment`.`UserId`
                INNER JOIN `AspNetRoles` AS `role` ON `role`.`Id` = `userRole`.`RoleId`
                INNER JOIN `Services` AS `service` ON `service`.`DepartmentId` = `assignment`.`DepartmentId`
                WHERE `role`.`NormalizedName` = 'STAFF'
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserServices");
        }
    }
}
