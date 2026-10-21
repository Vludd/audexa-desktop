using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace audexa_backend.Migrations;

public partial class NormalizeScenarioDelays : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("UPDATE ScenarioSteps SET DelayMs = DelayMs * 1000 WHERE DelayMs > 0;");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("UPDATE ScenarioSteps SET DelayMs = DelayMs / 1000 WHERE DelayMs > 0;");
    }
}
