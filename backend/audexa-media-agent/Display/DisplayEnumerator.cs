using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace Audexa.MediaAgent.Display;

public sealed class DisplayEnumerator
{
    private const int EnumCurrentSettings = -1;
    private const uint DmDisplayFrequency = 0x00400000;

    public IReadOnlyList<MediaDisplayDto> GetDisplays()
    {
        return Screen.AllScreens
            .Select(screen =>
            {
                var (name, refreshRate) = GetDisplayDetails(screen.DeviceName);

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

    private static (string Name, int RefreshRate) GetDisplayDetails(
        string deviceName)
    {
        var display = new DevMode
        {
            Size = (ushort)Marshal.SizeOf<DevMode>()
        };

        var refreshRate = 0;

        if (EnumDisplaySettings(
                deviceName,
                EnumCurrentSettings,
                ref display))
        {
            // DEVMODE can contain a default/placeholder value when the driver
            // does not mark dmDisplayFrequency as valid. Do not report that as Hz.
            refreshRate = (display.Fields & DmDisplayFrequency) != 0 &&
                          display.DisplayFrequency > 1
                ? checked((int)display.DisplayFrequency)
                : 0;
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