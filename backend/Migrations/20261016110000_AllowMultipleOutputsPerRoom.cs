using audexa_backend.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace audexa_backend.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261016110000_AllowMultipleOutputsPerRoom")]
public partial class AllowMultipleOutputsPerRoom : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_OutputMappings_AudioConfigurationId_RoomId",
            table: "OutputMappings");

        migrationBuilder.CreateIndex(
            name: "IX_OutputMappings_AudioConfigurationId_RoomId",
            table: "OutputMappings",
            columns: new[] { "AudioConfigurationId", "RoomId" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // If multiple outputs have been assigned to a room, retain one mapping
        // per room before restoring the old uniqueness constraint.
        migrationBuilder.Sql("DELETE FROM OutputMappings WHERE Id NOT IN (SELECT MIN(Id) FROM OutputMappings GROUP BY AudioConfigurationId, RoomId)");
        migrationBuilder.DropIndex(
            name: "IX_OutputMappings_AudioConfigurationId_RoomId",
            table: "OutputMappings");
        migrationBuilder.CreateIndex(
            name: "IX_OutputMappings_AudioConfigurationId_RoomId",
            table: "OutputMappings",
            columns: new[] { "AudioConfigurationId", "RoomId" },
            unique: true);
    }
}
