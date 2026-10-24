using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Queuing.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class DepartmentLocalTicketCounter : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DepartmentTicketNumber",
                table: "DepartmentSteps",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "TicketDate",
                table: "DepartmentSteps",
                type: "date",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "DepartmentSequences",
                columns: table => new
                {
                    DepartmentId = table.Column<Guid>(type: "char(36)", nullable: false),
                    ClinicDate = table.Column<DateTime>(type: "date", nullable: false),
                    LastSequence = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DepartmentSequences", x => new { x.DepartmentId, x.ClinicDate });
                    table.ForeignKey(
                        name: "FK_DepartmentSequences_Departments_DepartmentId",
                        column: x => x.DepartmentId,
                        principalTable: "Departments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "UX_DepartmentSteps_DepartmentDateNumber",
                table: "DepartmentSteps",
                columns: new[] { "DepartmentId", "TicketDate", "DepartmentTicketNumber" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DepartmentSequences");

            migrationBuilder.DropIndex(
                name: "UX_DepartmentSteps_DepartmentDateNumber",
                table: "DepartmentSteps");

            migrationBuilder.DropColumn(
                name: "DepartmentTicketNumber",
                table: "DepartmentSteps");

            migrationBuilder.DropColumn(
                name: "TicketDate",
                table: "DepartmentSteps");
        }
    }
}
