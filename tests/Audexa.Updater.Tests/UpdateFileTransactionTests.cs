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

    public void Dispose()
    {
        if (Directory.Exists(_root))
            Directory.Delete(_root, recursive: true);
    }
}
