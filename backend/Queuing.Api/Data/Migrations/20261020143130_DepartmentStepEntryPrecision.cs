using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Queuing.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class DepartmentStepEntryPrecision : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<DateTimeOffset>(
                name: "EnteredAtUtc",
                table: "DepartmentSteps",
                type: "datetime(6)",
                precision: 6,
                nullable: false,
                oldClrType: typeof(DateTimeOffset),
                oldType: "datetime");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<DateTimeOffset>(
                name: "EnteredAtUtc",
                table: "DepartmentSteps",
                type: "datetime",
                nullable: false,
                oldClrType: typeof(DateTimeOffset),
                oldType: "datetime(6)",
                oldPrecision: 6);
        }
    }
}
