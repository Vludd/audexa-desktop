namespace audexa_backend.Security;

/// <summary>
/// Marks an endpoint that may be reached from the trusted local network.
/// The endpoint must still perform its own authentication where required.
/// This attribute only bypasses the Backend's loopback-only network boundary.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, Inherited = true)]
public sealed class LanAccessibleAttribute : Attribute
{
}
