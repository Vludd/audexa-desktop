using audexa_backend.DTOs;
using audexa_backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace audexa_backend.Controllers;

[ApiController]
[Route("api/rooms")]
public sealed class RoomsController : ControllerBase
{
    private readonly RoomService _roomService;

    public RoomsController(RoomService roomService)
    {
        _roomService = roomService;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<RoomDto>>> GetAll(
        CancellationToken cancellationToken)
    {
        var rooms = await _roomService.GetAllAsync(cancellationToken);

        return Ok(rooms);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<RoomDto>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var room = await _roomService.GetByIdAsync(
            id,
            cancellationToken);

        if (room is null)
        {
            return NotFound();
        }

        return Ok(room);
    }

    [HttpPost]
    public async Task<ActionResult<RoomDto>> Create(
        CreateRoomRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var room = await _roomService.CreateAsync(
                request,
                cancellationToken);

            return CreatedAtAction(
                nameof(GetById),
                new { id = room.Id },
                room);
        }
        catch (RoomValidationException ex)
        {
            var status = ex.Code == "SCENARIO_IN_USE"
                ? StatusCodes.Status409Conflict
                : StatusCodes.Status400BadRequest;

            return StatusCode(status, new
            {
                code = ex.Code,
                message = ex.Message
            });
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<RoomDto>> Update(
        Guid id,
        UpdateRoomRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var room = await _roomService.UpdateAsync(
                id,
                request,
                cancellationToken);

            if (room is null)
            {
                return NotFound();
            }

            return Ok(room);
        }
        catch (RoomValidationException ex)
        {
            var status = ex.Code == "SCENARIO_IN_USE"
                ? StatusCodes.Status409Conflict
                : StatusCodes.Status400BadRequest;

            return StatusCode(status, new
            {
                code = ex.Code,
                message = ex.Message
            });
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(
        Guid id,
        CancellationToken cancellationToken)
    {
        try
        {
            var deleted = await _roomService.DeleteAsync(
                id,
                cancellationToken);

            if (!deleted)
            {
                return NotFound();
            }

            return NoContent();
        }
        catch (RoomValidationException ex)
        {
            var status = ex.Code == "SCENARIO_IN_USE"
                ? StatusCodes.Status409Conflict
                : StatusCodes.Status400BadRequest;

            return StatusCode(status, new
            {
                code = ex.Code,
                message = ex.Message
            });
        }
    }
}