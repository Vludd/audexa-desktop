using audexa_backend.DTOs.Schedules;
using audexa_backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace audexa_backend.Controllers;

[ApiController]
[Route("api/schedules")]
public sealed class SchedulesController : ControllerBase
{
    private readonly ScheduleService _scheduleService;

    public SchedulesController(ScheduleService scheduleService)
    {
        _scheduleService = scheduleService;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ScheduleDto>>> GetAll(
        CancellationToken cancellationToken)
    {
        return Ok(await _scheduleService.GetAllAsync(cancellationToken));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ScheduleDto>> GetById(
        int id,
        CancellationToken cancellationToken)
    {
        var schedule = await _scheduleService.GetByIdAsync(id, cancellationToken);
        return schedule is null ? NotFound() : Ok(schedule);
    }

    [HttpPost]
    public async Task<ActionResult<ScheduleDto>> Create(
        CreateScheduleRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var schedule = await _scheduleService.CreateAsync(request, cancellationToken);
            return CreatedAtAction(nameof(GetById), new { id = schedule.Id }, schedule);
        }
        catch (ScheduleValidationException ex)
        {
            return BadRequest(new { code = ex.Code, message = ex.Message });
        }
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<ScheduleDto>> Update(
        int id,
        UpdateScheduleRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var schedule = await _scheduleService.UpdateAsync(id, request, cancellationToken);
            return schedule is null ? NotFound() : Ok(schedule);
        }
        catch (ScheduleValidationException ex)
        {
            return BadRequest(new { code = ex.Code, message = ex.Message });
        }
    }

    [HttpPatch("{id:int}/enabled")]
    public async Task<ActionResult<ScheduleDto>> Toggle(
        int id,
        ToggleScheduleRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var schedule = await _scheduleService.ToggleAsync(id, request, cancellationToken);
            return schedule is null ? NotFound() : Ok(schedule);
        }
        catch (ScheduleValidationException ex)
        {
            return BadRequest(new { code = ex.Code, message = ex.Message });
        }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(
        int id,
        CancellationToken cancellationToken)
    {
        return await _scheduleService.DeleteAsync(id, cancellationToken)
            ? NoContent()
            : NotFound();
    }
}
