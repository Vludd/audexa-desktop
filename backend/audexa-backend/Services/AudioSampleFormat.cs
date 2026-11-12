using System.Buffers.Binary;
using NAudio.Wave;

namespace audexa_backend.Services;

/// <summary>
/// Resolves and writes PCM/IEEE-float samples for both classic WaveFormat and
/// WAVE_FORMAT_EXTENSIBLE formats returned by Windows audio endpoints.
/// </summary>
internal static class AudioSampleFormat
{
    private static readonly Guid PcmSubFormat =
        new("00000001-0000-0010-8000-00aa00389b71");

    private static readonly Guid IeeeFloatSubFormat =
        new("00000003-0000-0010-8000-00aa00389b71");

    public static WaveFormatEncoding GetEncoding(WaveFormat format)
    {
        if (format is WaveFormatExtensible extensible)
        {
            if (extensible.SubFormat == PcmSubFormat)
                return WaveFormatEncoding.Pcm;

            if (extensible.SubFormat == IeeeFloatSubFormat)
                return WaveFormatEncoding.IeeeFloat;

            throw new NotSupportedException(
                $"Unsupported WAVE_FORMAT_EXTENSIBLE subformat '{extensible.SubFormat}'.");
        }

        return format.Encoding;
    }

    public static int BytesPerSample(WaveFormat format)
    {
        if (format.BitsPerSample <= 0 || format.BitsPerSample % 8 != 0)
            throw new NotSupportedException(
                $"Unsupported bits-per-sample value '{format.BitsPerSample}'.");

        return format.BitsPerSample / 8;
    }

    public static bool IsSupported(WaveFormat format)
    {
        try
        {
            var encoding = GetEncoding(format);
            return encoding switch
            {
                WaveFormatEncoding.IeeeFloat => format.BitsPerSample is 32 or 64,
                WaveFormatEncoding.Pcm => format.BitsPerSample is 8 or 16 or 24 or 32,
                _ => false
            };
        }
        catch (NotSupportedException)
        {
            return false;
        }
    }

    public static void WriteSample(Span<byte> destination, WaveFormat format, float value)
    {
        var encoding = GetEncoding(format);
        var bytesPerSample = BytesPerSample(format);

        if (destination.Length < bytesPerSample)
            throw new ArgumentException("Destination is smaller than one audio sample.", nameof(destination));

        value = Math.Clamp(value, -1f, 1f);

        if (encoding == WaveFormatEncoding.IeeeFloat)
        {
            if (format.BitsPerSample == 32)
            {
                BitConverter.TryWriteBytes(destination, value);
                return;
            }

            if (format.BitsPerSample == 64)
            {
                BitConverter.TryWriteBytes(destination, (double)value);
                return;
            }
        }
        else if (encoding == WaveFormatEncoding.Pcm)
        {
            switch (format.BitsPerSample)
            {
                case 8:
                    destination[0] = (byte)Math.Clamp(
                        (int)Math.Round(value * 127.5f + 127.5f), 0, 255);
                    return;

                case 16:
                    BinaryPrimitives.WriteInt16LittleEndian(
                        destination,
                        (short)Math.Clamp(
                            (int)Math.Round(value * 32767f),
                            short.MinValue,
                            short.MaxValue));
                    return;

                case 24:
                    var sample24 = (int)Math.Clamp(
                        Math.Round(value * 8388607d),
                        -8388608d,
                        8388607d);
                    destination[0] = (byte)sample24;
                    destination[1] = (byte)(sample24 >> 8);
                    destination[2] = (byte)(sample24 >> 16);
                    return;

                case 32:
                    BinaryPrimitives.WriteInt32LittleEndian(
                        destination,
                        (int)Math.Clamp(
                            Math.Round(value * 2147483647d),
                            int.MinValue,
                            int.MaxValue));
                    return;
            }
        }

        throw new NotSupportedException(
            $"Unsupported audio sample format: {encoding}, {format.BitsPerSample} bit.");
    }
}
