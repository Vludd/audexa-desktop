using System.Drawing;
using System.Windows.Forms;

namespace Audexa.MediaAgent.Infrastructure;

public sealed record FirstRunInput(string BackendUrl, string PairingCode);

public static class FirstRunDialog
{
    public static void ShowError(string message)
    {
        var thread = new Thread(() =>
        {
            Application.EnableVisualStyles();
            MessageBox.Show(message, "Audexa Media Agent", MessageBoxButtons.OK, MessageBoxIcon.Error);
        });
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        thread.Join();
    }

    public static FirstRunInput? Show(string discoveredBackendUrl)
    {
        FirstRunInput? result = null;
        Exception? failure = null;

        var thread = new Thread(() =>
        {
            try
            {
                Application.EnableVisualStyles();
                using var form = new Form
                {
                    Text = "Audexa Media Agent",
                    StartPosition = FormStartPosition.CenterScreen,
                    FormBorderStyle = FormBorderStyle.FixedDialog,
                    MaximizeBox = false,
                    MinimizeBox = false,
                    ClientSize = new Size(460, 250),
                    Font = new Font("Segoe UI", 9F)
                };

                var title = new Label
                {
                    Text = "Подключение к Audexa",
                    Font = new Font("Segoe UI", 15F, FontStyle.Bold),
                    AutoSize = true,
                    Location = new Point(24, 18)
                };
                var hint = new Label
                {
                    Text = "Укажите адрес Backend и одноразовый код, созданный администратором.",
                    AutoSize = false,
                    Size = new Size(410, 34),
                    Location = new Point(24, 52)
                };
                var urlLabel = new Label { Text = "Адрес Backend", AutoSize = true, Location = new Point(24, 98) };
                var url = new TextBox
                {
                    Text = discoveredBackendUrl,
                    Location = new Point(24, 118),
                    Size = new Size(410, 26),
                    Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right
                };
                var codeLabel = new Label { Text = "Код подключения", AutoSize = true, Location = new Point(24, 155) };
                var code = new TextBox
                {
                    Location = new Point(24, 175),
                    Size = new Size(220, 26),
                    CharacterCasing = CharacterCasing.Upper,
                    MaxLength = 13
                };
                var connect = new Button
                {
                    Text = "Подключить",
                    Location = new Point(290, 174),
                    Size = new Size(144, 30)
                };
                var cancel = new Button
                {
                    Text = "Отмена",
                    Location = new Point(350, 215),
                    Size = new Size(84, 26),
                    DialogResult = DialogResult.Cancel
                };

                connect.Click += (_, e) =>
                {
                    if (string.IsNullOrWhiteSpace(url.Text) || string.IsNullOrWhiteSpace(code.Text))
                    {
                        MessageBox.Show(form, "Заполните адрес Backend и код подключения.",
                            "Audexa", MessageBoxButtons.OK, MessageBoxIcon.Information);
                        form.DialogResult = DialogResult.None;
                        return;
                    }

                    result = new FirstRunInput(url.Text.Trim(), code.Text.Trim());
                    form.DialogResult = DialogResult.OK;
                    form.Close();
                };

                form.Controls.AddRange([title, hint, urlLabel, url, codeLabel, code, connect, cancel]);
                form.AcceptButton = connect;
                form.CancelButton = cancel;

                if (form.ShowDialog() != DialogResult.OK)
                    result = null;
            }
            catch (Exception ex)
            {
                failure = ex;
            }
        });

        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        thread.Join();

        if (failure is not null)
            throw new InvalidOperationException("Не удалось открыть окно первоначальной настройки Media Agent.", failure);

        return result;
    }
}
