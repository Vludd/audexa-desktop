using System;
using audexa_backend.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace audexa_backend.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261014100000_AddSchedules")]
public partial class AddSchedules : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "Schedules",
            columns: table => new
            {
                Id = table.Column<int>(type: "INTEGER", nullable: false)
                    .Annotation("Sqlite:Autoincrement", true),
                Time = table.Column<TimeSpan>(type: "TEXT", nullable: false),
                ScenarioId = table.Column<Guid>(type: "TEXT", nullable: false),
                Days = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                Repeat = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                Enabled = table.Column<bool>(type: "INTEGER", nullable: false),
                CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Schedules", x => x.Id);
                table.ForeignKey(
                    name: "FK_Schedules_Scenarios_ScenarioId",
                    column: x => x.ScenarioId,
                    principalTable: "Scenarios",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_Schedules_ScenarioId",
            table: "Schedules",
            column: "ScenarioId");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "Schedules");
    }
}
