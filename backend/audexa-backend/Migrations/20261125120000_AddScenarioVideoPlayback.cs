using audexa_backend.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace audexa_backend.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261125120000_AddScenarioVideoPlayback")]
public partial class AddScenarioVideoPlayback : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // SQLite requires a table rebuild to make the existing audio relations nullable
        // and add the optional video/host/display relations.
        migrationBuilder.Sql(
            """
            CREATE TABLE "ScenarioSteps_new" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_ScenarioSteps" PRIMARY KEY,
                "ScenarioId" TEXT NOT NULL,
                "Order" INTEGER NOT NULL,
                "RoomId" TEXT NULL,
                "AudioFileId" TEXT NULL,
                "DelayMs" INTEGER NOT NULL DEFAULT 0,
                "TranslationAudioFileId" TEXT NULL,
                "VideoFileId" TEXT NULL,
                "MediaHostId" TEXT NULL,
                "DisplayKey" TEXT NULL,
                "VideoAudioMode" TEXT NULL,
                CONSTRAINT "FK_ScenarioSteps_Scenarios_ScenarioId"
                    FOREIGN KEY ("ScenarioId") REFERENCES "Scenarios" ("Id") ON DELETE CASCADE,
                CONSTRAINT "FK_ScenarioSteps_Rooms_RoomId"
                    FOREIGN KEY ("RoomId") REFERENCES "Rooms" ("Id") ON DELETE RESTRICT,
                CONSTRAINT "FK_ScenarioSteps_AudioFiles_AudioFileId"
                    FOREIGN KEY ("AudioFileId") REFERENCES "AudioFiles" ("Id") ON DELETE RESTRICT,
                CONSTRAINT "FK_ScenarioSteps_AudioFiles_TranslationAudioFileId"
                    FOREIGN KEY ("TranslationAudioFileId") REFERENCES "AudioFiles" ("Id") ON DELETE RESTRICT,
                CONSTRAINT "FK_ScenarioSteps_VideoFiles_VideoFileId"
                    FOREIGN KEY ("VideoFileId") REFERENCES "VideoFiles" ("Id") ON DELETE RESTRICT,
                CONSTRAINT "FK_ScenarioSteps_MediaHosts_MediaHostId"
                    FOREIGN KEY ("MediaHostId") REFERENCES "MediaHosts" ("Id") ON DELETE RESTRICT
            );

            INSERT INTO "ScenarioSteps_new" (
                "Id", "ScenarioId", "Order", "RoomId", "AudioFileId", "DelayMs", "TranslationAudioFileId"
            )
            SELECT "Id", "ScenarioId", "Order", "RoomId", "AudioFileId", "DelayMs", "TranslationAudioFileId"
            FROM "ScenarioSteps";

            DROP TABLE "ScenarioSteps";
            ALTER TABLE "ScenarioSteps_new" RENAME TO "ScenarioSteps";

            CREATE INDEX "IX_ScenarioSteps_RoomId" ON "ScenarioSteps" ("RoomId");
            CREATE INDEX "IX_ScenarioSteps_AudioFileId" ON "ScenarioSteps" ("AudioFileId");
            CREATE INDEX "IX_ScenarioSteps_TranslationAudioFileId" ON "ScenarioSteps" ("TranslationAudioFileId");
            CREATE INDEX "IX_ScenarioSteps_VideoFileId" ON "ScenarioSteps" ("VideoFileId");
            CREATE INDEX "IX_ScenarioSteps_MediaHostId" ON "ScenarioSteps" ("MediaHostId");
            CREATE UNIQUE INDEX "IX_ScenarioSteps_ScenarioId_Order" ON "ScenarioSteps" ("ScenarioId", "Order");
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Existing rows created before this migration always contain audio and room IDs.
        migrationBuilder.Sql(
            """
            CREATE TABLE "ScenarioSteps_old" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_ScenarioSteps" PRIMARY KEY,
                "ScenarioId" TEXT NOT NULL,
                "Order" INTEGER NOT NULL,
                "RoomId" TEXT NOT NULL,
                "AudioFileId" TEXT NOT NULL,
                "DelayMs" INTEGER NOT NULL DEFAULT 0,
                "TranslationAudioFileId" TEXT NULL,
                CONSTRAINT "FK_ScenarioSteps_Scenarios_ScenarioId"
                    FOREIGN KEY ("ScenarioId") REFERENCES "Scenarios" ("Id") ON DELETE CASCADE,
                CONSTRAINT "FK_ScenarioSteps_Rooms_RoomId"
                    FOREIGN KEY ("RoomId") REFERENCES "Rooms" ("Id") ON DELETE RESTRICT,
                CONSTRAINT "FK_ScenarioSteps_AudioFiles_AudioFileId"
                    FOREIGN KEY ("AudioFileId") REFERENCES "AudioFiles" ("Id") ON DELETE RESTRICT,
                CONSTRAINT "FK_ScenarioSteps_AudioFiles_TranslationAudioFileId"
                    FOREIGN KEY ("TranslationAudioFileId") REFERENCES "AudioFiles" ("Id") ON DELETE RESTRICT
            );
            INSERT INTO "ScenarioSteps_old" (
                "Id", "ScenarioId", "Order", "RoomId", "AudioFileId", "DelayMs", "TranslationAudioFileId"
            )
            SELECT "Id", "ScenarioId", "Order", "RoomId", "AudioFileId", "DelayMs", "TranslationAudioFileId"
            FROM "ScenarioSteps" WHERE "RoomId" IS NOT NULL AND "AudioFileId" IS NOT NULL;
            DROP TABLE "ScenarioSteps";
            ALTER TABLE "ScenarioSteps_old" RENAME TO "ScenarioSteps";
            CREATE INDEX "IX_ScenarioSteps_RoomId" ON "ScenarioSteps" ("RoomId");
            CREATE INDEX "IX_ScenarioSteps_AudioFileId" ON "ScenarioSteps" ("AudioFileId");
            CREATE INDEX "IX_ScenarioSteps_TranslationAudioFileId" ON "ScenarioSteps" ("TranslationAudioFileId");
            CREATE UNIQUE INDEX "IX_ScenarioSteps_ScenarioId_Order" ON "ScenarioSteps" ("ScenarioId", "Order");
            """);
    }
}
