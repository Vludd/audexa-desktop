using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace audexa_backend.Migrations;

public partial class HardenScheduleExecution : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<DateOnly>(
            name: "ExecutionDate",
            table: "Schedules",
            type: "TEXT",
            nullable: true);

        migrationBuilder.AddColumn<DateTime>(
            name: "LastTriggeredAt",
            table: "Schedules",
            type: "TEXT",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "LastExecutionStatus",
            table: "Schedules",
            type: "TEXT",
            maxLength: 32,
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "ExecutionDate", table: "Schedules");
        migrationBuilder.DropColumn(name: "LastTriggeredAt", table: "Schedules");
        migrationBuilder.DropColumn(name: "LastExecutionStatus", table: "Schedules");
    }
}
