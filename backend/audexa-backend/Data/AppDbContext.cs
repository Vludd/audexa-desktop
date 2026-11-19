using audexa_backend.Models;
using Microsoft.EntityFrameworkCore;

namespace audexa_backend.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public DbSet<AudioFile> AudioFiles => Set<AudioFile>();

    public DbSet<VideoFile> VideoFiles => Set<VideoFile>();

    public DbSet<AudioConfiguration> AudioConfigurations => Set<AudioConfiguration>();

    public DbSet<OutputMapping> OutputMappings => Set<OutputMapping>();

    public DbSet<Room> Rooms => Set<Room>();

    public DbSet<Scenario> Scenarios => Set<Scenario>();

    public DbSet<ScenarioStep> ScenarioSteps => Set<ScenarioStep>();

    public DbSet<Schedule> Schedules => Set<Schedule>();

    public DbSet<MediaHost> MediaHosts => Set<MediaHost>();

    public DbSet<DisplayDevice> DisplayDevices => Set<DisplayDevice>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<MediaHost>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Name).IsRequired().HasMaxLength(200);
            entity.Property(x => x.MachineName).IsRequired().HasMaxLength(200);
            entity.Property(x => x.AgentVersion).IsRequired().HasMaxLength(64);
            entity.Property(x => x.Status).IsRequired().HasMaxLength(16);
            entity.HasMany(x => x.Displays).WithOne(x => x.MediaHost)
                .HasForeignKey(x => x.MediaHostId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<DisplayDevice>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.DisplayKey).IsRequired().HasMaxLength(256);
            entity.Property(x => x.DeviceName).IsRequired().HasMaxLength(256);
            entity.Property(x => x.FriendlyName).IsRequired().HasMaxLength(256);
            entity.HasIndex(x => new { x.MediaHostId, x.DisplayKey }).IsUnique();
        });

        modelBuilder.Entity<AudioConfiguration>()
            .HasKey(x => x.Id);

        modelBuilder.Entity<AudioConfiguration>()
            .HasMany(x => x.Mappings)
            .WithOne(x => x.AudioConfiguration)
            .HasForeignKey(x => x.AudioConfigurationId)
            .OnDelete(DeleteBehavior.Cascade);

        // A room can own multiple output channels; a physical output can still
        // belong to only one room (enforced by the unique output index below).
        modelBuilder.Entity<OutputMapping>()
            .HasIndex(x => new { x.AudioConfigurationId, x.RoomId });

        modelBuilder.Entity<OutputMapping>()
            .HasIndex(x => new { x.AudioConfigurationId, x.OutputId })
            .IsUnique();

        modelBuilder.Entity<VideoFile>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Name).IsRequired().HasMaxLength(255);
            entity.Property(x => x.FileName).IsRequired().HasMaxLength(255);
            entity.Property(x => x.StorageFileName).IsRequired().HasMaxLength(80);
            entity.Property(x => x.Format).IsRequired().HasMaxLength(16);
            entity.Property(x => x.Sha256).IsRequired().HasMaxLength(64);
            entity.HasIndex(x => x.CreatedAt);
        });

        modelBuilder.Entity<AudioFile>()
            .Property(x => x.Volume)
            .IsRequired()
            .HasDefaultValue(100);

        modelBuilder.Entity<AudioFile>()
            .Property(x => x.VolumeDb)
            .IsRequired()
            .HasDefaultValue(0);

        modelBuilder.Entity<Room>()
            .HasKey(x => x.Id);

        modelBuilder.Entity<Room>()
            .Property(x => x.Name)
            .IsRequired()
            .HasMaxLength(200);

        modelBuilder.Entity<Room>()
            .Property(x => x.Volume)
            .IsRequired()
            .HasDefaultValue(100);


        modelBuilder.Entity<Room>()
            .HasMany(x => x.OutputMappings)
            .WithOne()
            .HasForeignKey(x => x.RoomId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Scenario>()
            .HasKey(x => x.Id);

        modelBuilder.Entity<Scenario>()
            .Property(x => x.Name)
            .IsRequired()
            .HasMaxLength(200);

        modelBuilder.Entity<Scenario>()
            .Property(x => x.Description)
            .IsRequired()
            .HasMaxLength(2000);

        modelBuilder.Entity<Scenario>()
            .Property(x => x.Status)
            .IsRequired()
            .HasMaxLength(32);

        modelBuilder.Entity<Scenario>()
            .Property(x => x.PlayMode)
            .IsRequired()
            .HasMaxLength(32);

        modelBuilder.Entity<Scenario>()
            .Property(x => x.Repeat)
            .IsRequired()
            .HasMaxLength(32);

        modelBuilder.Entity<Scenario>()
            .HasMany(x => x.Steps)
            .WithOne(x => x.Scenario)
            .HasForeignKey(x => x.ScenarioId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ScenarioStep>()
            .HasKey(x => x.Id);

        modelBuilder.Entity<ScenarioStep>()
            .Property(x => x.Order)
            .IsRequired();


        modelBuilder.Entity<ScenarioStep>()
            .Property(x => x.DelayMs)
            .IsRequired()
            .HasDefaultValue(0);

        modelBuilder.Entity<ScenarioStep>()
            .HasIndex(x => new { x.ScenarioId, x.Order })
            .IsUnique();

        modelBuilder.Entity<Schedule>()
            .HasKey(x => x.Id);

        modelBuilder.Entity<Schedule>()
            .Property(x => x.Time)
            .IsRequired();

        modelBuilder.Entity<Schedule>()
            .Property(x => x.Days)
            .IsRequired()
            .HasMaxLength(64);

        modelBuilder.Entity<Schedule>()
            .Property(x => x.Repeat)
            .IsRequired()
            .HasMaxLength(16);

        modelBuilder.Entity<Schedule>()
            .Property(x => x.LastExecutionStatus)
            .HasMaxLength(32);

        modelBuilder.Entity<Schedule>()
            .HasOne(x => x.Scenario)
            .WithMany()
            .HasForeignKey(x => x.ScenarioId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Schedule>()
            .HasIndex(x => x.ScenarioId);

        modelBuilder.Entity<ScenarioStep>()
            .HasOne(x => x.Room)
            .WithMany()
            .HasForeignKey(x => x.RoomId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ScenarioStep>()
            .HasOne(x => x.AudioFile)
            .WithMany()
            .HasForeignKey(x => x.AudioFileId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ScenarioStep>()
            .HasOne(x => x.TranslationAudioFile)
            .WithMany()
            .HasForeignKey(x => x.TranslationAudioFileId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}