using audexa_backend.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace audexa_backend.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261124110000_AddMediaHostPairing")]
public partial class AddMediaHostPairing : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "MediaHostPairings",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                CodeHash = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                HostName = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                Description = table.Column<string>(type: "TEXT", maxLength: 1000, nullable: true),
                CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                ExpiresAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                UsedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                RevokedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                FailedAttempts = table.Column<int>(type: "INTEGER", nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_MediaHostPairings", x => x.Id));

        migrationBuilder.CreateTable(
            name: "MediaHostCredentials",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                MediaHostId = table.Column<Guid>(type: "TEXT", nullable: false),
                SecretHash = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                RevokedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                LastUsedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_MediaHostCredentials", x => x.Id);
                table.ForeignKey(
                    name: "FK_MediaHostCredentials_MediaHosts_MediaHostId",
                    column: x => x.MediaHostId,
                    principalTable: "MediaHosts",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_MediaHostPairings_CodeHash",
            table: "MediaHostPairings",
            column: "CodeHash",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_MediaHostCredentials_MediaHostId_RevokedAtUtc",
            table: "MediaHostCredentials",
            columns: new[] { "MediaHostId", "RevokedAtUtc" });

        migrationBuilder.CreateIndex(
            name: "IX_MediaHostCredentials_SecretHash",
            table: "MediaHostCredentials",
            column: "SecretHash",
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "MediaHostCredentials");
        migrationBuilder.DropTable(name: "MediaHostPairings");
    }
}
