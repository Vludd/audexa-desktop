using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace audexa_backend.Migrations;

public partial class SimplifyAudioVolumeModel : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(
            name: "Volume",
            table: "AudioFiles",
            type: "INTEGER",
            nullable: false,
            defaultValue: 100);

        migrationBuilder.DropForeignKey(
            name: "FK_Rooms_AudioFiles_AudioFileId",
            table: "Rooms");

        migrationBuilder.DropIndex(
            name: "IX_Rooms_AudioFileId",
            table: "Rooms");

        migrationBuilder.DropColumn(
            name: "AudioFileId",
            table: "Rooms");

        migrationBuilder.DropColumn(
            name: "Volume",
            table: "ScenarioSteps");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(
            name: "Volume",
            table: "ScenarioSteps",
            type: "INTEGER",
            nullable: false,
            defaultValue: 100);

        migrationBuilder.AddColumn<Guid>(
            name: "AudioFileId",
            table: "Rooms",
            type: "TEXT",
            nullable: true);

        migrationBuilder.CreateIndex(
            name: "IX_Rooms_AudioFileId",
            table: "Rooms",
            column: "AudioFileId");

        migrationBuilder.AddForeignKey(
            name: "FK_Rooms_AudioFiles_AudioFileId",
            table: "Rooms",
            column: "AudioFileId",
            principalTable: "AudioFiles",
            principalColumn: "Id",
            onDelete: ReferentialAction.SetNull);

        migrationBuilder.DropColumn(
            name: "Volume",
            table: "AudioFiles");
    }
}
