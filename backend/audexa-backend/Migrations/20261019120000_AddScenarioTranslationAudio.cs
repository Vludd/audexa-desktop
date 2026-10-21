using audexa_backend.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace audexa_backend.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261019120000_AddScenarioTranslationAudio")]
public partial class AddScenarioTranslationAudio : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // SQLite cannot add a foreign key with ALTER TABLE. Rebuild ScenarioSteps
        // while preserving every existing row and all current constraints/indexes.
        migrationBuilder.Sql(
            """
            CREATE TABLE "ScenarioSteps_new" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_ScenarioSteps" PRIMARY KEY,
                "ScenarioId" TEXT NOT NULL,
                "Order" INTEGER NOT NULL,
                "RoomId" TEXT NOT NULL,
                "AudioFileId" TEXT NOT NULL,
                "DelayMs" INTEGER NOT NULL DEFAULT 0,
                "TranslationAudioFileId" TEXT NULL,
                CONSTRAINT "FK_ScenarioSteps_AudioFiles_AudioFileId"
                    FOREIGN KEY ("AudioFileId") REFERENCES "AudioFiles" ("Id") ON DELETE RESTRICT,
                CONSTRAINT "FK_ScenarioSteps_AudioFiles_TranslationAudioFileId"
                    FOREIGN KEY ("TranslationAudioFileId") REFERENCES "AudioFiles" ("Id") ON DELETE RESTRICT,
                CONSTRAINT "FK_ScenarioSteps_Rooms_RoomId"
                    FOREIGN KEY ("RoomId") REFERENCES "Rooms" ("Id") ON DELETE RESTRICT,
                CONSTRAINT "FK_ScenarioSteps_Scenarios_ScenarioId"
                    FOREIGN KEY ("ScenarioId") REFERENCES "Scenarios" ("Id") ON DELETE CASCADE
            );

            INSERT INTO "ScenarioSteps_new" (
                "Id", "ScenarioId", "Order", "RoomId", "AudioFileId", "DelayMs"
            )
            SELECT "Id", "ScenarioId", "Order", "RoomId", "AudioFileId", "DelayMs"
            FROM "ScenarioSteps";

            DROP TABLE "ScenarioSteps";
            ALTER TABLE "ScenarioSteps_new" RENAME TO "ScenarioSteps";

            CREATE INDEX "IX_ScenarioSteps_AudioFileId" ON "ScenarioSteps" ("AudioFileId");
            CREATE INDEX "IX_ScenarioSteps_RoomId" ON "ScenarioSteps" ("RoomId");
            CREATE UNIQUE INDEX "IX_ScenarioSteps_ScenarioId_Order" ON "ScenarioSteps" ("ScenarioId", "Order");
            CREATE INDEX "IX_ScenarioSteps_TranslationAudioFileId" ON "ScenarioSteps" ("TranslationAudioFileId");
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Rebuild the table without the optional translation relation.
        migrationBuilder.Sql(
            """
            CREATE TABLE "ScenarioSteps_old" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_ScenarioSteps" PRIMARY KEY,
                "ScenarioId" TEXT NOT NULL,
                "Order" INTEGER NOT NULL,
                "RoomId" TEXT NOT NULL,
                "AudioFileId" TEXT NOT NULL,
                "DelayMs" INTEGER NOT NULL DEFAULT 0,
                CONSTRAINT "FK_ScenarioSteps_AudioFiles_AudioFileId"
                    FOREIGN KEY ("AudioFileId") REFERENCES "AudioFiles" ("Id") ON DELETE RESTRICT,
                CONSTRAINT "FK_ScenarioSteps_Rooms_RoomId"
                    FOREIGN KEY ("RoomId") REFERENCES "Rooms" ("Id") ON DELETE RESTRICT,
                CONSTRAINT "FK_ScenarioSteps_Scenarios_ScenarioId"
                    FOREIGN KEY ("ScenarioId") REFERENCES "Scenarios" ("Id") ON DELETE CASCADE
            );

            INSERT INTO "ScenarioSteps_old" (
                "Id", "ScenarioId", "Order", "RoomId", "AudioFileId", "DelayMs"
            )
            SELECT "Id", "ScenarioId", "Order", "RoomId", "AudioFileId", "DelayMs"
            FROM "ScenarioSteps";

            DROP TABLE "ScenarioSteps";
            ALTER TABLE "ScenarioSteps_old" RENAME TO "ScenarioSteps";

            CREATE INDEX "IX_ScenarioSteps_AudioFileId" ON "ScenarioSteps" ("AudioFileId");
            CREATE INDEX "IX_ScenarioSteps_RoomId" ON "ScenarioSteps" ("RoomId");
            CREATE UNIQUE INDEX "IX_ScenarioSteps_ScenarioId_Order" ON "ScenarioSteps" ("ScenarioId", "Order");
            """);
    }
}
