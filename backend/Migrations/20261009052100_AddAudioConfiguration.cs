using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace audexa_backend.Migrations
{
    /// <inheritdoc />
    public partial class AddAudioConfiguration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AudioConfigurations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Version = table.Column<int>(type: "INTEGER", nullable: false),
                    DeviceId = table.Column<string>(type: "TEXT", nullable: true),
                    TranslationOutputId = table.Column<string>(type: "TEXT", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AudioConfigurations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "OutputMappings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    RoomId = table.Column<Guid>(type: "TEXT", nullable: false),
                    OutputId = table.Column<string>(type: "TEXT", nullable: false),
                    AudioConfigurationId = table.Column<Guid>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OutputMappings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OutputMappings_AudioConfigurations_AudioConfigurationId",
                        column: x => x.AudioConfigurationId,
                        principalTable: "AudioConfigurations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OutputMappings_AudioConfigurationId_OutputId",
                table: "OutputMappings",
                columns: new[] { "AudioConfigurationId", "OutputId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OutputMappings_AudioConfigurationId_RoomId",
                table: "OutputMappings",
                columns: new[] { "AudioConfigurationId", "RoomId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OutputMappings");

            migrationBuilder.DropTable(
                name: "AudioConfigurations");
        }
    }
}
