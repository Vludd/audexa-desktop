using audexa_backend.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace audexa_backend.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261125130000_AddVideoGainDb")]
public partial class AddVideoGainDb : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(
            name: "GainDb",
            table: "VideoFiles",
            type: "INTEGER",
            nullable: false,
            defaultValue: 0);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "GainDb",
            table: "VideoFiles");
    }
}
