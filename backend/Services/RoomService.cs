using audexa_backend.Data;
using audexa_backend.DTOs;
using audexa_backend.Models;
using Microsoft.EntityFrameworkCore;

namespace audexa_backend.Services;

public sealed class RoomService
{
    private readonly AppDbContext _db;

    public RoomService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyCollection<RoomDto>> GetAllAsync(
        CancellationToken cancellationToken = default)
    {
        return await _db.Rooms
            .AsNoTracking()
            .OrderBy(x => x.Name)
            .Select(x => new RoomDto(
                x.Id,
                x.Name,
                x.Volume))
            .ToListAsync(cancellationToken);
    }

    public async Task<RoomDto?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        return await _db.Rooms
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new RoomDto(
                x.Id,
                x.Name,
                x.Volume))
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<RoomDto> CreateAsync(
        CreateRoomRequest request,
        CancellationToken cancellationToken = default)
    {
        var name = request.Name.Trim();

        ValidateName(name);
        ValidateVolume(request.Volume);


        var room = new Room
        {
            Id = Guid.NewGuid(),
            Name = name,
            Volume = request.Volume
        };

        _db.Rooms.Add(room);

        await _db.SaveChangesAsync(cancellationToken);

        return ToDto(room);
    }

    public async Task<RoomDto?> UpdateAsync(
        Guid id,
        UpdateRoomRequest request,
        CancellationToken cancellationToken = default)
    {
        var room = await _db.Rooms
            .FirstOrDefaultAsync(
                x => x.Id == id,
                cancellationToken);

        if (room is null)
        {
            return null;
        }

        var name = request.Name.Trim();

        ValidateName(name);
        ValidateVolume(request.Volume);


        room.Name = name;
        room.Volume = request.Volume;

        await _db.SaveChangesAsync(cancellationToken);

        return ToDto(room);
    }

    public async Task<bool> DeleteAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var room = await _db.Rooms
            .FirstOrDefaultAsync(
                x => x.Id == id,
                cancellationToken);

        if (room is null)
        {
            return false;
        }

        var usedByScenario = await _db.ScenarioSteps
            .AnyAsync(x => x.RoomId == id, cancellationToken);

        if (usedByScenario)
        {
            throw new RoomValidationException(
                "SCENARIO_IN_USE",
                "Room cannot be deleted because it is used by one or more scenarios.");
        }

        _db.Rooms.Remove(room);

        await _db.SaveChangesAsync(cancellationToken);

        return true;
    }

    private static void ValidateName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new RoomValidationException(
                "INVALID_NAME",
                "Room name is required.");
        }

        if (name.Length > 200)
        {
            throw new RoomValidationException(
                "INVALID_NAME",
                "Room name cannot exceed 200 characters.");
        }
    }

    private static void ValidateVolume(int volume)
    {
        if (volume is < 0 or > 100)
        {
            throw new RoomValidationException(
                "INVALID_VOLUME",
                "Room volume must be between 0 and 100.");
        }
    }

    private static RoomDto ToDto(Room room)
    {
        return new RoomDto(
            room.Id,
            room.Name,
            room.Volume);
    }
}

public sealed class RoomValidationException : Exception
{
    public RoomValidationException(
        string code,
        string message)
        : base(message)
    {
        Code = code;
    }

    public string Code { get; }
}