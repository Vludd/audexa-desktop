using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace audexa_backend.Migrations
{
    /// <inheritdoc />
    public partial class AddScenarios : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Scenarios",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "TEXT", maxLength: 2000, nullable: false),
                    Status = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    PlayMode = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    Repeat = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    StopPrevious = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Scenarios", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ScenarioSteps",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ScenarioId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Order = table.Column<int>(type: "INTEGER", nullable: false),
                    RoomId = table.Column<Guid>(type: "TEXT", nullable: false),
                    AudioFileId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Volume = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 100),
                    DelayMs = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 0)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScenarioSteps", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ScenarioSteps_AudioFiles_AudioFileId",
                        column: x => x.AudioFileId,
                        principalTable: "AudioFiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScenarioSteps_Rooms_RoomId",
                        column: x => x.RoomId,
                        principalTable: "Rooms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScenarioSteps_Scenarios_ScenarioId",
                        column: x => x.ScenarioId,
                        principalTable: "Scenarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ScenarioSteps_AudioFileId",
                table: "ScenarioSteps",
                column: "AudioFileId");

            migrationBuilder.CreateIndex(
                name: "IX_ScenarioSteps_RoomId",
                table: "ScenarioSteps",
                column: "RoomId");

            migrationBuilder.CreateIndex(
                name: "IX_ScenarioSteps_ScenarioId_Order",
                table: "ScenarioSteps",
                columns: new[] { "ScenarioId", "Order" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ScenarioSteps");

            migrationBuilder.DropTable(
                name: "Scenarios");
        }
    }
}
