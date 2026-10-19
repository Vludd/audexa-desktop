using audexa_backend.DTOs.Scenarios;
using audexa_backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace audexa_backend.Controllers;

[ApiController]
[Route("api/scenarios")]
public sealed class ScenariosController : ControllerBase
{
    private readonly ScenarioService _scenarioService;

    public ScenariosController(ScenarioService scenarioService)
    {
        _scenarioService = scenarioService;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ScenarioDto>>> GetAll(
        CancellationToken cancellationToken)
    {
        return Ok(await _scenarioService.GetAllAsync(cancellationToken));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ScenarioDto>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var scenario = await _scenarioService.GetByIdAsync(id, cancellationToken);

        return scenario is null ? NotFound() : Ok(scenario);
    }

    [HttpPost]
    public async Task<ActionResult<ScenarioDto>> Create(
        CreateScenarioRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var scenario = await _scenarioService.CreateAsync(
                request,
                cancellationToken);

            return CreatedAtAction(
                nameof(GetById),
                new { id = scenario.Id },
                scenario);
        }
        catch (ScenarioValidationException ex)
        {
            return BadRequest(new
            {
                code = ex.Code,
                message = ex.Message,
                errors = ex.Errors
            });
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ScenarioDto>> Update(
        Guid id,
        UpdateScenarioRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var scenario = await _scenarioService.UpdateAsync(
                id,
                request,
                cancellationToken);

            return scenario is null ? NotFound() : Ok(scenario);
        }
        catch (ScenarioValidationException ex)
        {
            return BadRequest(new
            {
                code = ex.Code,
                message = ex.Message,
                errors = ex.Errors
            });
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(
        Guid id,
        CancellationToken cancellationToken)
    {
        return await _scenarioService.DeleteAsync(id, cancellationToken)
            ? NoContent()
            : NotFound();
    }

    [HttpPost("{id:guid}/validate")]
    public async Task<ActionResult<ScenarioValidationDto>> Validate(
        Guid id,
        CancellationToken cancellationToken)
    {
        var result = await _scenarioService.ValidateAsync(id, cancellationToken);

        return result is null ? NotFound() : Ok(result);
    }
}
