using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace Audexa.MediaAgent.Display;

public sealed class DisplayEnumerator
{
    private const int EnumCurrentSettings = -1;
    private const uint DmDisplayFrequency = 0x00400000;

    private const uint QdcOnlyActivePaths = 0x00000002;
    private const int ErrorSuccess = 0;
    private const uint DisplayConfigDeviceInfoGetSourceName = 1;

    public IReadOnlyList<MediaDisplayDto> GetDisplays()
    {
        // QueryDisplayConfig reports the active signal timing as a rational
        // refresh rate and maps it to the GDI device name used by WinForms.
        var refreshRates = GetActiveRefreshRates();

        return Screen.AllScreens
            .Select(screen =>
            {
                var (name, fallbackRefreshRate) = GetDisplayDetails(screen.DeviceName);
                var refreshRate = refreshRates.TryGetValue(screen.DeviceName, out var activeRate)
                    ? activeRate
                    : fallbackRefreshRate;

                return new MediaDisplayDto(
                    DeviceId: screen.DeviceName,
                    Name: name,
                    Width: screen.Bounds.Width,
                    Height: screen.Bounds.Height,
                    RefreshRate: refreshRate,
                    IsPrimary: screen.Primary);
            })
            .OrderByDescending(x => x.IsPrimary)
            .ThenBy(x => x.DeviceId, StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    private static Dictionary<string, int> GetActiveRefreshRates()
    {
        var result = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        try
        {
            var status = GetDisplayConfigBufferSizes(
                QdcOnlyActivePaths,
                out var pathCount,
                out var modeCount);

            if (status != ErrorSuccess || pathCount == 0)
                return result;

            // QueryDisplayConfig requires buffers sized from the preceding call.
            // Retry once if the topology changes between sizing and querying.
            for (var attempt = 0; attempt < 2; attempt++)
            {
                var pathBuffer = Marshal.AllocHGlobal(
                    checked((int)Math.Max(1, pathCount) * Marshal.SizeOf<DisplayConfigPathInfo>()));
                var modeBuffer = Marshal.AllocHGlobal(
                    checked((int)Math.Max(1, modeCount) * Marshal.SizeOf<DisplayConfigModeInfo>()));

                try
                {
                    var actualPathCount = pathCount;
                    var actualModeCount = modeCount;

                    status = QueryDisplayConfig(
                        QdcOnlyActivePaths,
                        ref actualPathCount,
                        pathBuffer,
                        ref actualModeCount,
                        modeBuffer,
                        IntPtr.Zero);

                    if (status == ErrorSuccess)
                    {
                        var pathSize = Marshal.SizeOf<DisplayConfigPathInfo>();

                        for (var i = 0; i < actualPathCount; i++)
                        {
                            var path = Marshal.PtrToStructure<DisplayConfigPathInfo>(
                                IntPtr.Add(pathBuffer, checked((int)i * pathSize)));

                            var sourceName = new DisplayConfigSourceDeviceName
                            {
                                Header = new DisplayConfigDeviceInfoHeader
                                {
                                    Type = DisplayConfigDeviceInfoGetSourceName,
                                    Size = (uint)Marshal.SizeOf<DisplayConfigSourceDeviceName>(),
                                    AdapterId = path.SourceInfo.AdapterId,
                                    Id = path.SourceInfo.Id
                                }
                            };

                            if (DisplayConfigGetDeviceInfo(ref sourceName) != ErrorSuccess ||
                                string.IsNullOrWhiteSpace(sourceName.ViewGdiDeviceName))
                            {
                                continue;
                            }

                            var rate = path.TargetInfo.RefreshRate;
                            if (rate.Denominator == 0 || rate.Numerator == 0)
                                continue;

                            var hz = (double)rate.Numerator / rate.Denominator;
                            if (double.IsFinite(hz) && hz > 1 && hz < 1000)
                            {
                                result[sourceName.ViewGdiDeviceName] =
                                    checked((int)Math.Round(hz, MidpointRounding.AwayFromZero));
                            }
                        }

                        return result;
                    }

                    if (status != 122 || attempt > 0) // ERROR_INSUFFICIENT_BUFFER
                        return result;
                }
                finally
                {
                    Marshal.FreeHGlobal(pathBuffer);
                    Marshal.FreeHGlobal(modeBuffer);
                }

                status = GetDisplayConfigBufferSizes(
                    QdcOnlyActivePaths,
                    out pathCount,
                    out modeCount);

                if (status != ErrorSuccess)
                    return result;
            }
        }
        catch
        {
            // Display enumeration must remain available even when a graphics
            // driver does not implement the DisplayConfig query correctly.
        }

        return result;
    }

    private static (string Name, int RefreshRate) GetDisplayDetails(string deviceName)
    {
        var display = new DevMode
        {
            Size = (ushort)Marshal.SizeOf<DevMode>()
        };

        var refreshRate = 0;

        if (EnumDisplaySettings(deviceName, EnumCurrentSettings, ref display) &&
            (display.Fields & DmDisplayFrequency) != 0 &&
            display.DisplayFrequency > 1 &&
            display.DisplayFrequency < 1000)
        {
            refreshRate = checked((int)display.DisplayFrequency);
        }

        var monitorName = deviceName;
        var monitor = new DisplayDevice
        {
            Size = Marshal.SizeOf<DisplayDevice>()
        };

        if (EnumDisplayDevices(deviceName, 0, ref monitor, 0) &&
            !string.IsNullOrWhiteSpace(monitor.DeviceString))
        {
            monitorName = monitor.DeviceString;
        }

        return (monitorName, refreshRate);
    }

    [DllImport("user32.dll", EntryPoint = "GetDisplayConfigBufferSizes")]
    private static extern int GetDisplayConfigBufferSizes(
        uint flags,
        out uint numPathArrayElements,
        out uint numModeInfoArrayElements);

    [DllImport("user32.dll", EntryPoint = "QueryDisplayConfig")]
    private static extern int QueryDisplayConfig(
        uint flags,
        ref uint numPathArrayElements,
        IntPtr pathArray,
        ref uint numModeInfoArrayElements,
        IntPtr modeInfoArray,
        IntPtr currentTopologyId);

    [DllImport("user32.dll", EntryPoint = "DisplayConfigGetDeviceInfo")]
    private static extern int DisplayConfigGetDeviceInfo(
        ref DisplayConfigSourceDeviceName requestPacket);

    [DllImport(
        "user32.dll",
        EntryPoint = "EnumDisplaySettingsW",
        CharSet = CharSet.Unicode,
        ExactSpelling = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool EnumDisplaySettings(
        string deviceName,
        int modeNum,
        ref DevMode devMode);

    [DllImport(
        "user32.dll",
        EntryPoint = "EnumDisplayDevicesW",
        CharSet = CharSet.Unicode,
        ExactSpelling = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool EnumDisplayDevices(
        string? deviceName,
        uint deviceNumber,
        ref DisplayDevice displayDevice,
        uint flags);

    [StructLayout(LayoutKind.Sequential)]
    private struct Luid
    {
        public uint LowPart;
        public int HighPart;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct DisplayConfigRational
    {
        public uint Numerator;
        public uint Denominator;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct DisplayConfigPathSourceInfo
    {
        public Luid AdapterId;
        public uint Id;
        public uint ModeInfoIdx;
        public uint StatusFlags;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct DisplayConfigPathTargetInfo
    {
        public Luid AdapterId;
        public uint Id;
        public uint ModeInfoIdx;
        public uint OutputTechnology;
        public uint Rotation;
        public uint Scaling;
        public DisplayConfigRational RefreshRate;
        public uint ScanLineOrdering;
        [MarshalAs(UnmanagedType.Bool)]
        public bool TargetAvailable;
        public uint StatusFlags;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct DisplayConfigPathInfo
    {
        public DisplayConfigPathSourceInfo SourceInfo;
        public DisplayConfigPathTargetInfo TargetInfo;
        public uint Flags;
    }

    // QueryDisplayConfig writes DISPLAYCONFIG_MODE_INFO entries into this
    // buffer. The largest union member (DISPLAYCONFIG_TARGET_MODE) is 48 bytes.
    [StructLayout(LayoutKind.Sequential)]
    private struct DisplayConfigModeInfo
    {
        public uint InfoType;
        public uint Id;
        public Luid AdapterId;
        public long Reserved0;
        public long Reserved1;
        public long Reserved2;
        public long Reserved3;
        public long Reserved4;
        public long Reserved5;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct DisplayConfigDeviceInfoHeader
    {
        public uint Type;
        public uint Size;
        public Luid AdapterId;
        public uint Id;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct DisplayConfigSourceDeviceName
    {
        public DisplayConfigDeviceInfoHeader Header;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
        public string ViewGdiDeviceName;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct DisplayDevice
    {
        public int Size;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
        public string DeviceName;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
        public string DeviceString;

        public int StateFlags;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
        public string DeviceId;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
        public string DeviceKey;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct DevMode
    {
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
        public string DeviceName;

        public ushort SpecVersion;
        public ushort DriverVersion;
        public ushort Size;
        public ushort DriverExtra;
        public uint Fields;
        public DevModeUnion Union;
        public short Color;
        public short Duplex;
        public short YResolution;
        public short TTOption;
        public short Collate;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
        public string FormName;

        public ushort LogPixels;
        public uint BitsPerPel;
        public uint PelsWidth;
        public uint PelsHeight;
        public uint DisplayFlags;
        public uint DisplayFrequency;
        public uint ICMMethod;
        public uint ICMIntent;
        public uint MediaType;
        public uint DitherType;
        public uint Reserved1;
        public uint Reserved2;
        public uint PanningWidth;
        public uint PanningHeight;
    }

    [StructLayout(LayoutKind.Explicit)]
    private struct DevModeUnion
    {
        [FieldOffset(0)]
        public DisplayPosition Position;

        [FieldOffset(0)]
        public int DisplayOrientation;

        [FieldOffset(0)]
        public int DisplayFixedOutput;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct DisplayPosition
    {
        public int X;
        public int Y;
    }
}
