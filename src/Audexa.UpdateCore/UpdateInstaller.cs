
using System;

namespace Audexa.UpdateCore;

/// <summary>
/// Executes an installation update as a transaction.
/// Creates a backup before applying changes and restores the
/// original installation if the update operation fails.
/// </summary>
public sealed class UpdateInstaller
{
    private readonly UpdateFileTransaction _transaction;

    public UpdateInstaller()
        : this(new UpdateFileTransaction())
    {
    }

    public UpdateInstaller(UpdateFileTransaction transaction)
    {
        _transaction = transaction
            ?? throw new ArgumentNullException(nameof(transaction));
    }

    /// <summary>
    /// Thrown when applying an update fails and rollback also fails.
    /// The backup must be preserved for manual recovery.
    /// </summary>
    public sealed class RollbackFailedException : Exception
    {
        public string BackupDirectory { get; }

        public Exception UpdateException { get; }

        public Exception RollbackException { get; }

        public RollbackFailedException(
            string backupDirectory,
            Exception updateException,
            Exception rollbackException)
            : base(
                $"Update failed: {updateException.Message}" +
                $"{Environment.NewLine}" +
                $"Rollback also failed: {rollbackException.Message}" +
                $"{Environment.NewLine}" +
                $"The backup must be preserved at: {backupDirectory}",
                updateException)
        {
            BackupDirectory = backupDirectory;
            UpdateException = updateException;
            RollbackException = rollbackException;
        }
    }

    /// <summary>
    /// Creates a backup and executes the update operation.
    /// If the operation fails, automatically rolls back the installation.
    ///
    /// Exceptions thrown by the update operation are rethrown unchanged
    /// when rollback succeeds.
    /// RollbackFailedException is thrown when rollback cannot complete.
    /// </summary>
    /// <param name="target">Installation directory.</param>
    /// <param name="backup">Backup directory.</param>
    /// <param name="applyUpdate">
    /// Operation that applies the update to the installation.
    /// It must include all changes that need to be rolled back.
    /// </param>
    public void Execute(
        string target,
        string backup,
        Action<UpdateFileTransaction.Snapshot> applyUpdate)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(target);
        ArgumentException.ThrowIfNullOrWhiteSpace(backup);
        ArgumentNullException.ThrowIfNull(applyUpdate);

        // If backup creation fails, applyUpdate is never invoked.
        UpdateFileTransaction.Snapshot snapshot =
            _transaction.CreateBackup(target, backup);

        try
        {
            applyUpdate(snapshot);
        }
        catch (Exception updateException)
        {
            try
            {
                _transaction.Rollback(target, backup, snapshot);
            }
            catch (Exception rollbackException)
            {
                throw new RollbackFailedException(
                    backup,
                    updateException,
                    rollbackException);
            }

            // Preserve the original exception and its stack trace.
            throw;
        }
    }
}
