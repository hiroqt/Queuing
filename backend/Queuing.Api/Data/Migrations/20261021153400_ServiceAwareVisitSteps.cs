using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Queuing.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class ServiceAwareVisitSteps : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ServiceId",
                table: "DepartmentSteps",
                type: "char(36)",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_DepartmentSteps_DepartmentId_ServiceId",
                table: "DepartmentSteps",
                columns: new[] { "DepartmentId", "ServiceId" });

            migrationBuilder.AddForeignKey(
                name: "FK_DepartmentSteps_Services_DepartmentId_ServiceId",
                table: "DepartmentSteps",
                columns: new[] { "DepartmentId", "ServiceId" },
                principalTable: "Services",
                principalColumns: new[] { "DepartmentId", "Id" },
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_DepartmentSteps_Services_DepartmentId_ServiceId",
                table: "DepartmentSteps");

            migrationBuilder.DropIndex(
                name: "IX_DepartmentSteps_DepartmentId_ServiceId",
                table: "DepartmentSteps");

            migrationBuilder.DropColumn(
                name: "ServiceId",
                table: "DepartmentSteps");
        }
    }
}
