using audexa_backend.Logging;
using Microsoft.AspNetCore.Mvc;

namespace audexa_backend.Controllers;

[ApiController]
[Route("api/logs")]
public sealed class LogsController : ControllerBase
{
    private readonly JsonFileLoggerProvider _logs;

    public LogsController(JsonFileLoggerProvider logs) => _logs = logs;

    [HttpGet]
    public ActionResult<IReadOnlyList<object>> Get([FromQuery] int limit = 1000)
    {
        var records = _logs.ReadRecent(limit).Select((item, index) => (object)new
        {
            id = $"{item.Timestamp.ToUnixTimeMilliseconds()}-{item.EventId}-{index}",
            timestamp = item.Timestamp,
            time = item.Timestamp.LocalDateTime.ToString("HH:mm:ss"),
            level = NormalizeLevel(item.Level),
            source = item.Source,
            @event = item.Event,
            message = item.Message,
            context = new
            {
                category = item.Category,
                eventId = item.EventId,
                exceptionType = item.ExceptionType,
                exceptionMessage = item.ExceptionMessage
            }
        }).ToList();

        return Ok(records);
    }

    [HttpDelete]
    public IActionResult Clear()
    {
        _logs.Clear();
        return NoContent();
    }

    private static string NormalizeLevel(string level) => level switch
    {
        "CRITICAL" => "ERROR",
        "WARNING" => "WARNING",
        "ERROR" => "ERROR",
        _ => "INFO"
    };
}
