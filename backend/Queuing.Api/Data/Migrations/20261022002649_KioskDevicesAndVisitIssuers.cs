using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Queuing.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class KioskDevicesAndVisitIssuers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Guid>(
                name: "IssuedByUserId",
                table: "Visits",
                type: "char(36)",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "char(36)");

            migrationBuilder.AddColumn<Guid>(
                name: "IssuedByKioskDeviceId",
                table: "Visits",
                type: "char(36)",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ActorKioskDeviceId",
                table: "AuditRecords",
                type: "char(36)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "KioskDevices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false),
                    Name = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false),
                    Active = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    PairingCodeHash = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true),
                    PairingExpiresAtUtc = table.Column<DateTimeOffset>(type: "datetime", nullable: true),
                    CredentialHash = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true),
                    PairedAtUtc = table.Column<DateTimeOffset>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KioskDevices", x => x.Id);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_Visits_IssuedByKioskDeviceId",
                table: "Visits",
                column: "IssuedByKioskDeviceId");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Visits_ExactlyOneIssuer",
                table: "Visits",
                sql: "(`IssuedByUserId` IS NOT NULL AND `IssuedByKioskDeviceId` IS NULL) OR (`IssuedByUserId` IS NULL AND `IssuedByKioskDeviceId` IS NOT NULL)");

            migrationBuilder.CreateIndex(
                name: "IX_AuditRecords_ActorKioskDeviceId",
                table: "AuditRecords",
                column: "ActorKioskDeviceId");

            migrationBuilder.CreateIndex(
                name: "IX_KioskDevices_CredentialHash",
                table: "KioskDevices",
                column: "CredentialHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_KioskDevices_PairingCodeHash",
                table: "KioskDevices",
                column: "PairingCodeHash",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_AuditRecords_KioskDevices_ActorKioskDeviceId",
                table: "AuditRecords",
                column: "ActorKioskDeviceId",
                principalTable: "KioskDevices",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Visits_KioskDevices_IssuedByKioskDeviceId",
                table: "Visits",
                column: "IssuedByKioskDeviceId",
                principalTable: "KioskDevices",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            throw new NotSupportedException("Kiosk-issued visit history cannot be represented by the prior required-user issuer schema. Restore a pre-migration backup after retaining kiosk-issued visits and audit records.");
        }
    }
}
