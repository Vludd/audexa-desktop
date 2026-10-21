using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace audexa_backend.Migrations
{
    /// <inheritdoc />
    public partial class AddRooms : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Rooms",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    AudioFileId = table.Column<Guid>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Rooms", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Rooms_AudioFiles_AudioFileId",
                        column: x => x.AudioFileId,
                        principalTable: "AudioFiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OutputMappings_RoomId",
                table: "OutputMappings",
                column: "RoomId");

            migrationBuilder.CreateIndex(
                name: "IX_Rooms_AudioFileId",
                table: "Rooms",
                column: "AudioFileId");

            migrationBuilder.AddForeignKey(
                name: "FK_OutputMappings_Rooms_RoomId",
                table: "OutputMappings",
                column: "RoomId",
                principalTable: "Rooms",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_OutputMappings_Rooms_RoomId",
                table: "OutputMappings");

            migrationBuilder.DropTable(
                name: "Rooms");

            migrationBuilder.DropIndex(
                name: "IX_OutputMappings_RoomId",
                table: "OutputMappings");
        }
    }
}
