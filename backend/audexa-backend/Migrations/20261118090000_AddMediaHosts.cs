using audexa_backend.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace audexa_backend.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261118090000_AddMediaHosts")]
public partial class AddMediaHosts : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "MediaHosts",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                Name = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                MachineName = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                AgentVersion = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                Status = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                IpAddress = table.Column<string>(type: "TEXT", nullable: true),
                CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                LastSeenAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_MediaHosts", x => x.Id));

        migrationBuilder.CreateTable(
            name: "DisplayDevices",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                MediaHostId = table.Column<Guid>(type: "TEXT", nullable: false),
                DisplayKey = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                DeviceName = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                FriendlyName = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                Width = table.Column<int>(type: "INTEGER", nullable: false),
                Height = table.Column<int>(type: "INTEGER", nullable: false),
                RefreshRate = table.Column<int>(type: "INTEGER", nullable: false),
                IsPrimary = table.Column<bool>(type: "INTEGER", nullable: false),
                UpdatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_DisplayDevices", x => x.Id);
                table.ForeignKey("FK_DisplayDevices_MediaHosts_MediaHostId", x => x.MediaHostId, "MediaHosts", "Id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex("IX_DisplayDevices_MediaHostId_DisplayKey", "DisplayDevices", new[] { "MediaHostId", "DisplayKey" }, unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable("DisplayDevices");
        migrationBuilder.DropTable("MediaHosts");
    }
}
