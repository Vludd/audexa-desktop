namespace audexa_backend.DTOs;

public sealed record RoomDto(
    Guid Id,
    string Name,
    int Volume
);

public sealed record CreateRoomRequest(
    string Name,
    int Volume = 100
);

public sealed record UpdateRoomRequest(
    string Name,
    int Volume = 100
);
