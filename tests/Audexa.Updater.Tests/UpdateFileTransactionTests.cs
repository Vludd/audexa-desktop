using Audexa.UpdateCore;

namespace Audexa.Updater.Tests;

public sealed class UpdateFileTransactionTests : IDisposable
{
    private readonly string _root;
    private readonly string _target;
    private readonly string _backup;
    private readonly UpdateFileTransaction _transaction = new();

    public UpdateFileTransactionTests()
    {
        _root = Path.Combine(
            Path.GetTempPath(),
            "AudexaTests",
            Guid.NewGuid().ToString("N"));

        _target = Path.Combine(_root, "target");
        _backup = Path.Combine(_root, "backup");

        Directory.CreateDirectory(_target);
    }

    [Fact]
    public void CreateBackup_CopiesOriginalFiles()
    {
        string original = Path.Combine(_target, "app.txt");
        File.WriteAllText(original, "original");

        UpdateFileTransaction.Snapshot snapshot =
            _transaction.CreateBackup(_target, _backup);

        Assert.Contains("app.txt", snapshot.OriginalFiles);
        Assert.Equal(
            "original",
            File.ReadAllText(Path.Combine(_backup, "app.txt")));
    }

    [Fact]
    public void Rollback_RestoresModifiedOriginalFile()
    {
        File.WriteAllText(Path.Combine(_target, "app.txt"), "original");

        UpdateFileTransaction.Snapshot snapshot =
            _transaction.CreateBackup(_target, _backup);

        File.WriteAllText(Path.Combine(_target, "app.txt"), "updated");

        _transaction.Rollback(_target, _backup, snapshot);

        Assert.Equal(
            "original",
            File.ReadAllText(Path.Combine(_target, "app.txt")));
    }

    [Fact]
    public void Rollback_RemovesNewFilesAndKeepsUnchangedOriginalFiles()
    {
        File.WriteAllText(Path.Combine(_target, "app.txt"), "original");

        UpdateFileTransaction.Snapshot snapshot =
            _transaction.CreateBackup(_target, _backup);

        File.WriteAllText(Path.Combine(_target, "new.txt"), "new file");

        _transaction.Rollback(_target, _backup, snapshot);

        Assert.False(File.Exists(Path.Combine(_target, "new.txt")));
        Assert.Equal(
            "original",
            File.ReadAllText(Path.Combine(_target, "app.txt")));
    }

    [Theory]
    [InlineData("../outside.txt")]
    [InlineData("folder/../outside.txt")]
    [InlineData("CON.txt")]
    [InlineData("folder/name.")]
    [InlineData("folder/name ")]
    [InlineData(@"folder\file.txt")]
    [InlineData(@"C:\outside.txt")]
    public void GetSafeRelativePath_RejectsUnsafePaths(string path)
    {
        Assert.Throws<InvalidDataException>(
            () => UpdateFileTransaction.GetSafeRelativePath(path));
    }

    [Fact]
    public void Rollback_FailsIfBackupFileIsMissing()
    {
        File.WriteAllText(Path.Combine(_target, "app.txt"), "original");

        UpdateFileTransaction.Snapshot snapshot =
            _transaction.CreateBackup(_target, _backup);

        File.Delete(Path.Combine(_backup, "app.txt"));

        Assert.Throws<IOException>(
            () => _transaction.Rollback(_target, _backup, snapshot));
    }

    [Fact]
    public void CreateBackup_CopiesNestedFilesAndTracksDirectories()
    {
        string nestedDirectory = Path.Combine(_target, "frontend", "assets");
        Directory.CreateDirectory(nestedDirectory);

        string nestedFile = Path.Combine(nestedDirectory, "app.js");
        File.WriteAllText(nestedFile, "original frontend");

        UpdateFileTransaction.Snapshot snapshot =
            _transaction.CreateBackup(_target, _backup);

        Assert.Contains("frontend/assets/app.js", snapshot.OriginalFiles);
        Assert.Contains("frontend", snapshot.OriginalDirectories);
        Assert.Contains("frontend/assets", snapshot.OriginalDirectories);

        Assert.Equal(
            "original frontend",
            File.ReadAllText(
                Path.Combine(_backup, "frontend", "assets", "app.js")));
    }

    [Fact]
    public void Rollback_RestoresNestedFilesAndRemovesNewNestedFiles()
    {
        string nestedDirectory = Path.Combine(_target, "frontend", "assets");
        Directory.CreateDirectory(nestedDirectory);

        string originalFile = Path.Combine(nestedDirectory, "app.js");
        File.WriteAllText(originalFile, "original");

        UpdateFileTransaction.Snapshot snapshot =
            _transaction.CreateBackup(_target, _backup);

        File.WriteAllText(originalFile, "updated");

        string newDirectory = Path.Combine(_target, "frontend", "new-assets");
        Directory.CreateDirectory(newDirectory);

        string newFile = Path.Combine(newDirectory, "new.js");
        File.WriteAllText(newFile, "new file");

        _transaction.Rollback(_target, _backup, snapshot);

        Assert.Equal("original", File.ReadAllText(originalFile));
        Assert.False(File.Exists(newFile));
        Assert.False(Directory.Exists(newDirectory));
    }

    [Fact]
    public void Rollback_RestoresOriginalFileAfterMultipleChanges()
    {
        File.WriteAllText(Path.Combine(_target, "desktop.exe"), "desktop-v1");
        File.WriteAllText(Path.Combine(_target, "config.json"), "config-v1");

        UpdateFileTransaction.Snapshot snapshot =
            _transaction.CreateBackup(_target, _backup);

        File.WriteAllText(Path.Combine(_target, "desktop.exe"), "desktop-v2");
        File.WriteAllText(Path.Combine(_target, "config.json"), "config-v2");
        File.WriteAllText(Path.Combine(_target, "new.dll"), "new library");

        _transaction.Rollback(_target, _backup, snapshot);

        Assert.Equal(
            "desktop-v1",
            File.ReadAllText(Path.Combine(_target, "desktop.exe")));

        Assert.Equal(
            "config-v1",
            File.ReadAllText(Path.Combine(_target, "config.json")));

        Assert.False(File.Exists(Path.Combine(_target, "new.dll")));
    }

    [Fact]
    public void CreateBackup_RejectsBackupInsideTarget()
    {
        string nestedBackup = Path.Combine(_target, "backup");

        Assert.Throws<InvalidDataException>(
            () => _transaction.CreateBackup(_target, nestedBackup));
    }

    [Fact]
    public void CreateBackup_RejectsBackupEqualToTarget()
    {
        Assert.Throws<InvalidDataException>(
            () => _transaction.CreateBackup(_target, _target));
    }

    [Fact]
    public void Rollback_RestoresOriginalEmptyDirectories()
    {
        string emptyDirectory = Path.Combine(_target, "empty");
        Directory.CreateDirectory(emptyDirectory);

        UpdateFileTransaction.Snapshot snapshot =
            _transaction.CreateBackup(_target, _backup);

        Directory.Delete(emptyDirectory);

        _transaction.Rollback(_target, _backup, snapshot);

        Assert.True(Directory.Exists(emptyDirectory));
        Assert.Empty(Directory.EnumerateFileSystemEntries(emptyDirectory));
    }

    [Fact]
    public void Rollback_RestoresInstallationAfterSimulatedMidUpdateFailure()
    {
        // Arrange: исходная установка.
        string desktop = Path.Combine(_target, "desktop.exe");
        string config = Path.Combine(_target, "config.json");
        string oldLibrary = Path.Combine(_target, "backend", "old.dll");

        Directory.CreateDirectory(Path.GetDirectoryName(oldLibrary)!);

        File.WriteAllText(desktop, "desktop-v1");
        File.WriteAllText(config, "config-v1");
        File.WriteAllText(oldLibrary, "library-v1");

        var before = Directory
            .EnumerateFiles(_target, "*", SearchOption.AllDirectories)
            .ToDictionary(
                file => Path.GetRelativePath(_target, file),
                file => File.ReadAllText(file));

        var snapshot = _transaction.CreateBackup(_target, _backup);

        // Act: часть обновления применилась, затем произошёл сбой.
        File.WriteAllText(desktop, "desktop-v2");
        File.WriteAllText(config, "config-v2");

        string newLibrary = Path.Combine(_target, "backend", "new.dll");
        File.WriteAllText(newLibrary, "library-v2");

        try
        {
            throw new IOException("Simulated failure during update");
        }
        catch (IOException)
        {
            _transaction.Rollback(_target, _backup, snapshot);
        }

        // Assert: исходный набор файлов и содержимое восстановлены.
        var after = Directory
            .EnumerateFiles(_target, "*", SearchOption.AllDirectories)
            .ToDictionary(
                file => Path.GetRelativePath(_target, file),
                file => File.ReadAllText(file));

        Assert.Equal(before.Count, after.Count);

        foreach (var original in before)
        {
            Assert.True(after.ContainsKey(original.Key),
                $"Original file missing after rollback: {original.Key}");

            Assert.Equal(original.Value, after[original.Key]);
        }

        Assert.False(File.Exists(newLibrary));
    }

    [Fact]
    public void Rollback_RestoresDeletedStaleFile()
    {
        string staleFile = Path.Combine(_target, "backend", "old.dll");
        Directory.CreateDirectory(Path.GetDirectoryName(staleFile)!);
        File.WriteAllText(staleFile, "original library");

        UpdateFileTransaction.Snapshot snapshot =
            _transaction.CreateBackup(_target, _backup);

        // Имитируем удаление устаревшего файла обновлением.
        File.Delete(staleFile);

        _transaction.Rollback(_target, _backup, snapshot);

        Assert.True(File.Exists(staleFile));
        Assert.Equal("original library", File.ReadAllText(staleFile));
    }

    [Fact]
    public void Rollback_RestoresPreviousManifestAfterReplacement()
    {
        string manifest = Path.Combine(_target, ".audexa-managed-files.json");
        File.WriteAllText(manifest, """{"version":"1.0.12","files":["old.dll"]}""");

        UpdateFileTransaction.Snapshot snapshot =
            _transaction.CreateBackup(_target, _backup);

        // Имитируем запись манифеста новой версии.
        File.WriteAllText(manifest, """{"version":"1.0.13","files":["new.dll"]}""");

        _transaction.Rollback(_target, _backup, snapshot);

        Assert.Equal(
            """{"version":"1.0.12","files":["old.dll"]}""",
            File.ReadAllText(manifest));
    }


    [Fact]
    public void UpdateInstaller_Execute_CommitsSuccessfulUpdate()
    {
        File.WriteAllText(Path.Combine(_target, "app.txt"), "original");

        var installer = new UpdateInstaller(_transaction);

        installer.Execute(_target, _backup, _ =>
        {
            File.WriteAllText(Path.Combine(_target, "app.txt"), "updated");
            File.WriteAllText(Path.Combine(_target, "new.txt"), "new file");
        });

        Assert.Equal("updated", File.ReadAllText(Path.Combine(_target, "app.txt")));
        Assert.Equal("new file", File.ReadAllText(Path.Combine(_target, "new.txt")));
        Assert.True(File.Exists(Path.Combine(_backup, "app.txt")));
    }

    [Fact]
    public void UpdateInstaller_Execute_RollsBackAndRethrowsOriginalException()
    {
        File.WriteAllText(Path.Combine(_target, "app.txt"), "original");

        var installer = new UpdateInstaller(_transaction);

        IOException exception = Assert.Throws<IOException>(() =>
            installer.Execute(_target, _backup, _ =>
            {
                File.WriteAllText(Path.Combine(_target, "app.txt"), "partially updated");
                File.WriteAllText(Path.Combine(_target, "new.txt"), "new file");
                throw new IOException("Simulated update failure");
            }));

        Assert.Equal("Simulated update failure", exception.Message);
        Assert.Equal("original", File.ReadAllText(Path.Combine(_target, "app.txt")));
        Assert.False(File.Exists(Path.Combine(_target, "new.txt")));
    }

    [Fact]
    public void UpdateInstaller_Execute_PreservesBackupWhenRollbackFails()
    {
        File.WriteAllText(Path.Combine(_target, "app.txt"), "original");

        var installer = new UpdateInstaller(_transaction);

        UpdateInstaller.RollbackFailedException exception =
            Assert.Throws<UpdateInstaller.RollbackFailedException>(() =>
                installer.Execute(_target, _backup, _ =>
                {
                    File.WriteAllText(Path.Combine(_target, "app.txt"), "partially updated");

                    // Имитируем повреждение резервной копии, из-за которого откат невозможен.
                    File.Delete(Path.Combine(_backup, "app.txt"));

                    throw new IOException("Simulated update failure");
                }));

        Assert.Equal(_backup, exception.BackupDirectory);
        Assert.IsType<IOException>(exception.UpdateException);
        Assert.Equal("Simulated update failure", exception.UpdateException.Message);
        Assert.IsType<IOException>(exception.RollbackException);
        Assert.True(Directory.Exists(_backup));
        Assert.Equal("partially updated", File.ReadAllText(Path.Combine(_target, "app.txt")));
    }

    public void Dispose()
    {
        if (Directory.Exists(_root))
            Directory.Delete(_root, recursive: true);
    }
}
