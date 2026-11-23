using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using System.Web.Script.Serialization;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace SAZORA
{
    static class Program
    {
        static HttpListener listener;
        public static string appDir;
        public static int port = 8715;
        static Mutex instanceMutex;

        [STAThread]
        static void Main()
        {
            // تک‌نمونه‌ای: جلوگیری از باز شدن چند پنجره
            bool createdNew;
            try
            {
                instanceMutex = new Mutex(true, "Global\\SAZORA_SingleInstance_v1", out createdNew);
            }
            catch
            {
                // اگر دسترسی به فضای Global نبود، حداقل در نشست فعلی تک‌نمونه بمان
                instanceMutex = new Mutex(true, "Local\\SAZORA_SingleInstance_v1", out createdNew);
            }
            if (!createdNew)
            {
                ActivateExistingWindow();
                return;
            }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            // GitHub به TLS 1.2 نیاز دارد؛ پیش‌فرض قدیمی .NET فقط SSL3/TLS1 است و بررسی به‌روزرسانی شکست می‌خورد
            try { ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12; } catch { }

            appDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            string wwwRoot = Path.Combine(appDir, "app");

            if (!Directory.Exists(wwwRoot))
            {
                MessageBox.Show("پوشه app پیدا نشد! لطفاً برنامه را از اول نصب کنید.", "SAZORA", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            if (!StartServer(wwwRoot)) return;

            // Autostart
            try
            {
                string startup = Environment.GetFolderPath(Environment.SpecialFolder.Startup);
                string lnk = Path.Combine(startup, "SAZORA.lnk");
                if (File.Exists(lnk)) File.Delete(lnk);
                Type t = Type.GetTypeFromProgID("WScript.Shell");
                object shell = Activator.CreateInstance(t);
                object shortcut = t.InvokeMember("CreateShortcut", System.Reflection.BindingFlags.InvokeMethod, null, shell, new object[] { lnk });
                t.InvokeMember("TargetPath", System.Reflection.BindingFlags.SetProperty, null, shortcut, new object[] { Assembly.GetExecutingAssembly().Location });
                t.InvokeMember("WorkingDirectory", System.Reflection.BindingFlags.SetProperty, null, shortcut, new object[] { appDir });
                t.InvokeMember("Save", System.Reflection.BindingFlags.InvokeMethod, null, shortcut, null);
            }
            catch { }

            Application.Run(new MainForm());
        }

        /** فعال‌سازی پنجرهٔ نسخهٔ در حال اجرا (با کمی صبر تا پنجره آماده شود) */
        static void ActivateExistingWindow()
        {
            for (int i = 0; i < 15; i++)
            {
                IntPtr h = FindWindow(null, "SAZORA");
                if (h == IntPtr.Zero)
                {
                    try
                    {
                        foreach (Process p in Process.GetProcessesByName(Process.GetCurrentProcess().ProcessName))
                        {
                            if (p.Id != Process.GetCurrentProcess().Id && p.MainWindowHandle != IntPtr.Zero)
                            {
                                h = p.MainWindowHandle;
                                break;
                            }
                        }
                    }
                    catch { }
                }
                if (h != IntPtr.Zero)
                {
                    ShowWindow(h, 9); // SW_RESTORE
                    SetForegroundWindow(h);
                    return;
                }
                Thread.Sleep(200);
            }
        }

        /** بررسی اینکه پاسخ‌دهندهٔ پورت ۸۷۱۵ خود SAZORA است یا برنامهٔ دیگری */
        static bool IsOtherSazora()
        {
            try
            {
                var req = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:8715/__sazora");
                req.Timeout = 800;
                req.ReadWriteTimeout = 800;
                using (var resp = (HttpWebResponse)req.GetResponse())
                using (var sr = new StreamReader(resp.GetResponseStream()))
                {
                    return sr.ReadToEnd().IndexOf("SAZORA", StringComparison.OrdinalIgnoreCase) >= 0;
                }
            }
            catch { return false; }
        }

        /**
         * سرور محلی همیشه روی پورت ثابت ۸۷۱۵ اجرا می‌شود؛ چون داده‌های IndexedDB
         * به مبدأ (origin) همین پورت گره خورده‌اند و تغییر پورت یعنی دیدن دادهٔ خالی.
         */
        static bool StartServer(string root)
        {
            while (true)
            {
                try
                {
                    listener = new HttpListener();
                    listener.Prefixes.Add("http://127.0.0.1:8715/");
                    listener.Start();
                    port = 8715;
                    ThreadPool.QueueUserWorkItem(new WaitCallback(Serve), root);
                    return true;
                }
                catch
                {
                    listener = null;
                }

                if (IsOtherSazora())
                {
                    MessageBox.Show(
                        "SAZORA از قبل باز است (شاید در نشست کاربری دیگری).\nلطفاً همان پنجره را ببندید و دوباره تلاش کنید.",
                        "SAZORA", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    return false;
                }

                DialogResult res = MessageBox.Show(
                    "پورت ۸۷۱۵ توسط برنامهٔ دیگری اشغال شده است.\n" +
                    "برای اینکه داده‌های شما درست نمایش داده شوند، SAZORA همیشه باید روی همین پورت اجرا شود.\n\n" +
                    "لطفاً برنامهٔ مزاحم را ببندید و «تلاش دوباره» را بزنید.",
                    "SAZORA — تداخل پورت", MessageBoxButtons.RetryCancel, MessageBoxIcon.Warning);
                if (res != DialogResult.Retry) return false;
            }
        }

        static void Serve(object state)
        {
            string root = (string)state;
            string rootFull = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            while (listener.IsListening)
            {
                try
                {
                    HttpListenerContext ctx = listener.GetContext();
                    string path = ctx.Request.Url.AbsolutePath.TrimStart('/');
                    if (string.IsNullOrEmpty(path)) path = "index.html";
                    if (path == "__sazora")
                    {
                        byte[] sig = Encoding.UTF8.GetBytes("SAZORA");
                        ctx.Response.ContentType = "text/plain; charset=utf-8";
                        ctx.Response.ContentLength64 = sig.Length;
                        ctx.Response.OutputStream.Write(sig, 0, sig.Length);
                        ctx.Response.Close();
                        continue;
                    }
                    string file = Path.GetFullPath(Path.Combine(root, path));
                    // جلوگیری از دسترسی به فایل‌های بیرون از پوشهٔ برنامه (path traversal)
                    if (file.StartsWith(rootFull, StringComparison.OrdinalIgnoreCase) && File.Exists(file))
                    {
                        byte[] data = File.ReadAllBytes(file);
                        ctx.Response.ContentType = GetMime(file);
                        ctx.Response.ContentLength64 = data.Length;
                        ctx.Response.OutputStream.Write(data, 0, data.Length);
                    }
                    else
                    {
                        ctx.Response.StatusCode = 404;
                    }
                    ctx.Response.Close();
                }
                catch { }
            }
        }

        static string GetMime(string file)
        {
            string ext = Path.GetExtension(file).ToLower();
            if (ext == ".html") return "text/html; charset=utf-8";
            if (ext == ".js") return "application/javascript; charset=utf-8";
            if (ext == ".mjs") return "application/javascript; charset=utf-8";
            if (ext == ".css") return "text/css; charset=utf-8";
            if (ext == ".json") return "application/json; charset=utf-8";
            if (ext == ".png") return "image/png";
            if (ext == ".jpg" || ext == ".jpeg") return "image/jpeg";
            if (ext == ".webp") return "image/webp";
            if (ext == ".svg") return "image/svg+xml";
            if (ext == ".wasm") return "application/wasm";
            if (ext == ".pdf") return "application/pdf";
            if (ext == ".woff2") return "font/woff2";
            if (ext == ".woff") return "font/woff";
            if (ext == ".ttf") return "font/ttf";
            if (ext == ".ico") return "image/x-icon";
            return "application/octet-stream";
        }

        public static void StopServer()
        {
            try { if (listener != null) listener.Stop(); } catch { }
            try { if (listener != null) listener.Close(); } catch { }
        }

        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);
        [DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
    }

    public class MainForm : Form
    {
        WebView2 browser;

        public MainForm()
        {
            Text = "SAZORA";
            Width = 1280;
            Height = 800;
            StartPosition = FormStartPosition.CenterScreen;
            WindowState = FormWindowState.Maximized;
            try {
                string icoPath = Path.Combine(Program.appDir, "app.ico");
                Icon = File.Exists(icoPath)
                    ? new System.Drawing.Icon(icoPath)
                    : System.Drawing.SystemIcons.Application;
            } catch {
                Icon = System.Drawing.SystemIcons.Application;
            }

            browser = new WebView2();
            browser.Dock = DockStyle.Fill;
            browser.CreationProperties = new CoreWebView2CreationProperties
            {
                UserDataFolder = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "SAZORA", "WebView2Data")
            };

            Controls.Add(browser);

            browser.CoreWebView2InitializationCompleted += (s, e) =>
            {
                if (e.IsSuccess)
                {
                    browser.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
                    browser.CoreWebView2.Settings.IsStatusBarEnabled = false;
                    browser.CoreWebView2.Settings.AreBrowserAcceleratorKeysEnabled = true;
                    browser.CoreWebView2.Settings.IsSwipeNavigationEnabled = false;
                    browser.CoreWebView2.Settings.IsGeneralAutofillEnabled = false;
                    browser.CoreWebView2.Settings.IsPasswordAutosaveEnabled = false;
                    browser.CoreWebView2.WebMessageReceived += OnWebMessage;
                    browser.CoreWebView2.Navigate("http://127.0.0.1:" + Program.port + "/");
                }
                else
                {
                    MessageBox.Show("WebView2 بارگذاری نشد: " + e.InitializationException.Message, "SAZORA", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            };

            browser.EnsureCoreWebView2Async(null);

            FormClosing += delegate(object s, FormClosingEventArgs e)
            {
                try { browser.Stop(); } catch { }
                try { Program.StopServer(); } catch { }
            };
        }

        /* ============================================================
           پل پیام وب‌اپ ← میزبان: نصب آپدیت، انتخاب پوشه، ذخیرهٔ فایل
           ============================================================ */
        void Post(object payload)
        {
            // پیام‌ها ممکن است از رشتهٔ پس‌زمینه (بررسی/دانلود آپدیت) بیایند
            if (browser.InvokeRequired)
            {
                try { browser.BeginInvoke((MethodInvoker)delegate { Post(payload); }); } catch { }
                return;
            }
            try
            {
                var ser = new JavaScriptSerializer();
                ser.MaxJsonLength = int.MaxValue;
                browser.CoreWebView2.PostWebMessageAsJson(ser.Serialize(payload));
            }
            catch { }
        }

        static Dictionary<string, object> AsObject(object value)
        {
            return value as Dictionary<string, object>;
        }

        static object[] AsArray(object value)
        {
            var arr = value as object[];
            if (arr != null) return arr;
            var list = value as System.Collections.ArrayList;
            return list != null ? list.ToArray() : new object[0];
        }

        static string GetText(Dictionary<string, object> d, string key)
        {
            if (d == null || !d.ContainsKey(key) || d[key] == null) return "";
            return Convert.ToString(d[key]);
        }

        static long GetNumber(Dictionary<string, object> d, string key)
        {
            if (d == null || !d.ContainsKey(key) || d[key] == null) return 0;
            long n;
            return long.TryParse(Convert.ToString(d[key]), out n) ? n : 0;
        }

        /** نسخهٔ «v1.9.12-beta» → «1.9.12» */
        static string CleanVersion(string value)
        {
            string v = (value ?? "").Trim();
            if (v.StartsWith("v", StringComparison.OrdinalIgnoreCase)) v = v.Substring(1);
            int dash = v.IndexOf('-');
            return dash >= 0 ? v.Substring(0, dash) : v;
        }

        static int CompareVersions(string a, string b)
        {
            string[] pa = CleanVersion(a).Split('.');
            string[] pb = CleanVersion(b).Split('.');
            int count = Math.Max(pa.Length, pb.Length);
            for (int i = 0; i < count; i++)
            {
                int x = 0, y = 0;
                if (i < pa.Length) int.TryParse(pa[i], out x);
                if (i < pb.Length) int.TryParse(pb[i], out y);
                if (x != y) return x < y ? -1 : 1;
            }
            return 0;
        }

        static bool IsAllowedUpdateUrl(string url)
        {
            Uri uri;
            if (!Uri.TryCreate(url, UriKind.Absolute, out uri)) return false;
            if (uri.Scheme != Uri.UriSchemeHttps) return false;
            string host = uri.Host.ToLowerInvariant();
            if (host == "github.com")
                return uri.AbsolutePath.StartsWith(
                    "/omidmasumi740-dev/sazora/releases/download/",
                    StringComparison.OrdinalIgnoreCase);
            return host == "objects.githubusercontent.com" || host.EndsWith(".githubusercontent.com", StringComparison.OrdinalIgnoreCase);
        }

        void PostUpdateError(string message)
        {
            Post(new Dictionary<string, object> {
                { "action", "update-error" }, { "message", message }
            });
        }

        /** بررسی آخرین انتشار در GitHub (بدون نیاز به توکن چون مخزن عمومی است) */
        void StartUpdateCheck(string currentVersion)
        {
            ThreadPool.QueueUserWorkItem(delegate
            {
                try
                {
                    var req = (HttpWebRequest)WebRequest.Create(
                        "https://api.github.com/repos/omidmasumi740-dev/sazora/releases/latest");
                    req.UserAgent = "SAZORA-Updater/1.0";
                    req.Accept = "application/vnd.github+json";
                    req.Timeout = 15000;
                    req.ReadWriteTimeout = 15000;

                    string json;
                    using (var resp = (HttpWebResponse)req.GetResponse())
                    using (var sr = new StreamReader(resp.GetResponseStream(), Encoding.UTF8))
                        json = sr.ReadToEnd();

                    var ser = new JavaScriptSerializer();
                    ser.MaxJsonLength = int.MaxValue;
                    var rel = ser.Deserialize<Dictionary<string, object>>(json);
                    if (rel == null) throw new Exception("پاسخ GitHub قابل خواندن نبود.");

                    string latest = CleanVersion(GetText(rel, "tag_name"));
                    string notes = GetText(rel, "body");
                    if (notes.Length > 6000) notes = notes.Substring(0, 6000) + "\n…";

                    string assetName = "", assetUrl = "", digest = "";
                    long assetSize = 0;
                    int bestRank = 99;
                    foreach (object item in AsArray(rel.ContainsKey("assets") ? rel["assets"] : null))
                    {
                        var asset = AsObject(item);
                        if (asset == null) continue;
                        string name = GetText(asset, "name");
                        if (!name.EndsWith(".zip", StringComparison.OrdinalIgnoreCase)) continue;
                        int rank = name.IndexOf("Update", StringComparison.OrdinalIgnoreCase) >= 0 ? 0
                            : name.IndexOf("Desktop", StringComparison.OrdinalIgnoreCase) >= 0 ? 1 : 2;
                        if (rank < bestRank)
                        {
                            bestRank = rank;
                            assetName = name;
                            assetUrl = GetText(asset, "browser_download_url");
                            assetSize = GetNumber(asset, "size");
                            digest = GetText(asset, "digest");
                        }
                    }

                    bool available = assetUrl.Length > 0 && CompareVersions(latest, currentVersion) > 0;
                    Post(new Dictionary<string, object> {
                        { "action", "update-check-result" },
                        { "ok", true },
                        { "currentVersion", CleanVersion(currentVersion) },
                        { "latestVersion", latest },
                        { "updateAvailable", available },
                        { "releaseUrl", GetText(rel, "html_url") },
                        { "assetName", assetName },
                        { "assetUrl", assetUrl },
                        { "assetSize", assetSize },
                        { "digest", digest },
                        { "notes", notes }
                    });
                }
                catch (WebException ex)
                {
                    var resp = ex.Response as HttpWebResponse;
                    if (resp != null && resp.StatusCode == HttpStatusCode.NotFound)
                        PostUpdateError("هنوز نسخه‌ای در GitHub منتشر نشده است.");
                    else
                        PostUpdateError("بررسی به‌روزرسانی ناموفق بود. اتصال اینترنت را بررسی کنید.");
                }
                catch (Exception ex)
                {
                    PostUpdateError(ex.Message);
                }
            });
        }

        /** دانلود فایل به‌روزرسانی از GitHub و اجرای نصب */
        void StartUpdateDownload(string url, string digest)
        {
            if (!IsAllowedUpdateUrl(url))
            {
                PostUpdateError("نشانی دانلود معتبر نیست؛ فقط انتشارهای همین مخزن مجاز است.");
                return;
            }
            string zipPath = Path.Combine(Path.GetTempPath(), "sazora-update.zip");
            ThreadPool.QueueUserWorkItem(delegate
            {
                try
                {
                    Post(new Dictionary<string, object> { { "action", "update-download-started" } });

                    var req = (HttpWebRequest)WebRequest.Create(url);
                    req.UserAgent = "SAZORA-Updater/1.0";
                    req.Timeout = 30000;
                    req.ReadWriteTimeout = 60000;
                    using (var resp = (HttpWebResponse)req.GetResponse())
                    using (var input = resp.GetResponseStream())
                    using (var output = File.Create(zipPath))
                    {
                        long total = resp.ContentLength;
                        long received = 0;
                        int lastPercent = -1;
                        byte[] buffer = new byte[131072];
                        int read;
                        while ((read = input.Read(buffer, 0, buffer.Length)) > 0)
                        {
                            output.Write(buffer, 0, read);
                            received += read;
                            if (total > 0)
                            {
                                int percent = (int)(received * 100 / total);
                                if (percent != lastPercent)
                                {
                                    lastPercent = percent;
                                    Post(new Dictionary<string, object> {
                                        { "action", "update-download-progress" },
                                        { "percent", percent },
                                        { "received", received },
                                        { "total", total }
                                    });
                                }
                            }
                        }
                    }

                    if (!string.IsNullOrEmpty(digest))
                    {
                        string expected = digest.Trim();
                        int colon = expected.IndexOf(':');
                        if (colon >= 0) expected = expected.Substring(colon + 1);
                        string actual;
                        using (var sha = SHA256.Create())
                        using (var fs = File.OpenRead(zipPath))
                        {
                            byte[] hash = sha.ComputeHash(fs);
                            var sb = new StringBuilder();
                            foreach (byte b in hash) sb.Append(b.ToString("x2"));
                            actual = sb.ToString();
                        }
                        if (!string.Equals(actual, expected, StringComparison.OrdinalIgnoreCase))
                        {
                            try { File.Delete(zipPath); } catch { }
                            PostUpdateError("فایل دانلودشده سالم نیست (هش SHA-256 مطابقت ندارد).");
                            return;
                        }
                    }

                    Post(new Dictionary<string, object> {
                        { "action", "update-ready" },
                        { "message", "دانلود کامل شد؛ اپ بسته و به‌روزرسانی می‌شود." }
                    });
                    if (browser.InvokeRequired)
                        browser.BeginInvoke((MethodInvoker)delegate { RunUpdater(zipPath); });
                    else
                        RunUpdater(zipPath);
                }
                catch (Exception ex)
                {
                    PostUpdateError("دانلود به‌روزرسانی ناموفق بود: " + ex.Message);
                }
            });
        }

        void OnWebMessage(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            try
            {
                string raw = e.TryGetWebMessageAsString();
                if (string.IsNullOrEmpty(raw)) return;
                var ser = new JavaScriptSerializer();
                ser.MaxJsonLength = int.MaxValue;
                var dict = ser.Deserialize<Dictionary<string, object>>(raw);
                if (dict == null) return;
                string action = dict.ContainsKey("action") ? Convert.ToString(dict["action"]) : "";

                if (action == "choose-folder")
                {
                    using (var dlg = new FolderBrowserDialog())
                    {
                        dlg.Description = "انتخاب پوشهٔ ذخیره‌سازی SAZORA";
                        dlg.ShowNewFolderButton = true;
                        string chosen = dlg.ShowDialog() == DialogResult.OK ? dlg.SelectedPath : "";
                        Post(new Dictionary<string, object> {
                            { "action", "folder-selected" }, { "path", chosen }
                        });
                    }
                }
                else if (action == "save-file")
                {
                    string folder = Convert.ToString(dict["folder"]);
                    string filename = Path.GetFileName(Convert.ToString(dict["filename"]));
                    string b64 = Convert.ToString(dict["base64"]);
                    Directory.CreateDirectory(folder);
                    string path = Path.Combine(folder, filename);
                    File.WriteAllBytes(path, Convert.FromBase64String(b64));
                    Post(new Dictionary<string, object> {
                        { "action", "file-saved" }, { "ok", true }, { "path", path }
                    });
                }
                else if (action == "save-secret" || action == "load-secret" || action == "delete-secret")
                {
                    string key = dict.ContainsKey("key") ? Convert.ToString(dict["key"]) : "";
                    string file = SecretFile(key);
                    if (action == "save-secret")
                    {
                        bool ok = false;
                        try
                        {
                            string value = dict.ContainsKey("value") ? Convert.ToString(dict["value"]) : "";
                            byte[] data = ProtectedData.Protect(Encoding.UTF8.GetBytes(value), SecretEntropy(), DataProtectionScope.CurrentUser);
                            File.WriteAllBytes(file, data);
                            ok = true;
                        }
                        catch { }
                        Post(new Dictionary<string, object> {
                            { "action", "secret-saved" }, { "ok", ok }
                        });
                    }
                    else if (action == "load-secret")
                    {
                        string value = "";
                        try
                        {
                            if (File.Exists(file))
                            {
                                byte[] data = ProtectedData.Unprotect(File.ReadAllBytes(file), SecretEntropy(), DataProtectionScope.CurrentUser);
                                value = Encoding.UTF8.GetString(data);
                            }
                        }
                        catch { }
                        Post(new Dictionary<string, object> {
                            { "action", "secret" }, { "key", key }, { "value", value }
                        });
                    }
                    else
                    {
                        bool ok = true;
                        try { if (File.Exists(file)) File.Delete(file); } catch { ok = false; }
                        Post(new Dictionary<string, object> {
                            { "action", "secret-deleted" }, { "ok", ok }
                        });
                    }
                }
                else if (action == "get-device-name")
                {
                    string name = "";
                    try { name = Environment.MachineName; } catch { }
                    Post(new Dictionary<string, object> {
                        { "action", "device-name" }, { "name", name }
                    });
                }
                else if (action == "install-update")
                {
                    string b64 = Convert.ToString(dict["zip"]);
                    byte[] bytes = Convert.FromBase64String(b64);
                    string tmpZip = Path.Combine(Path.GetTempPath(), "sazora-update.zip");
                    File.WriteAllBytes(tmpZip, bytes);
                    RunUpdater(tmpZip);
                }
                else if (action == "check-update")
                {
                    StartUpdateCheck(dict.ContainsKey("currentVersion") ? Convert.ToString(dict["currentVersion"]) : "0.0.0");
                }
                else if (action == "download-update")
                {
                    string url = dict.ContainsKey("url") ? Convert.ToString(dict["url"]) : "";
                    string digest = dict.ContainsKey("digest") ? Convert.ToString(dict["digest"]) : "";
                    StartUpdateDownload(url, digest);
                }
            }
            catch (Exception ex)
            {
                Post(new Dictionary<string, object> {
                    { "action", "host-error" }, { "message", ex.Message }
                });
            }
        }

        /* ---------- ذخیرهٔ امن نشست با DPAPI (فقط برای همین کاربر ویندوز) ---------- */

        static byte[] SecretEntropy()
        {
            return Encoding.UTF8.GetBytes("SAZORA.Secrets.v1");
        }

        static string SecretFile(string key)
        {
            string dir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "SAZORA",
                "secrets");
            Directory.CreateDirectory(dir);
            string safe = "secret";
            if (!string.IsNullOrEmpty(key))
            {
                var sb = new StringBuilder();
                foreach (char c in key)
                    if (char.IsLetterOrDigit(c) || c == '-' || c == '_') sb.Append(c);
                if (sb.Length > 0) safe = sb.ToString();
            }
            return Path.Combine(dir, safe + ".bin");
        }

        /** اجرای اسکریپت به‌روزرسانی: صبر تا بستن اپ، استخراج ZIP، اجرای مجدد */
        void RunUpdater(string zipPath)
        {
            string bat = Path.Combine(Path.GetTempPath(), "sazora-update.bat");
            string exe = Path.Combine(Program.appDir, "SAZORA.exe");
            var sb = new StringBuilder();
            sb.AppendLine("@echo off");
            sb.AppendLine("chcp 65001 >nul");
            sb.AppendLine(":wait");
            sb.AppendLine("tasklist /fi \"imagename eq SAZORA.exe\" | find /i \"SAZORA.exe\" >nul");
            sb.AppendLine("if errorlevel 1 goto install");
            sb.AppendLine("timeout /t 1 /nobreak >nul");
            sb.AppendLine("goto wait");
            sb.AppendLine(":install");
            string ps =
                "$zip='" + zipPath.Replace("'", "''") + "'; " +
                "$dest='" + Program.appDir.Replace("'", "''") + "'; " +
                "$tmp=Join-Path $env:TEMP ('sazora-extract-'+[guid]::NewGuid().ToString('N')); " +
                "Expand-Archive -LiteralPath $zip -DestinationPath $tmp -Force; " +
                "$root=$tmp; $items=@(Get-ChildItem -LiteralPath $tmp -Force); " +
                "if($items.Count -eq 1 -and $items[0].PSIsContainer){$candidate=$items[0].FullName; " +
                "if((Test-Path (Join-Path $candidate 'SAZORA.exe')) -or (Test-Path (Join-Path $candidate 'app'))){$root=$candidate}}; " +
                "$allowed=@('app','SAZORA.exe','app.ico','Microsoft.Web.WebView2.Core.dll','Microsoft.Web.WebView2.WinForms.dll','WebView2Loader.dll','README-DESKTOP.txt'); " +
                "Get-ChildItem -LiteralPath $root -Force | Where-Object { $allowed -contains $_.Name } | " +
                "ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $dest -Recurse -Force }; " +
                "Remove-Item -LiteralPath $tmp -Recurse -Force";
            sb.AppendLine("powershell -NoProfile -ExecutionPolicy Bypass -Command \"" + ps + "\"");
            sb.AppendLine("start \"\" \"" + exe + "\"");
            sb.AppendLine("del \"%~f0\"");
            File.WriteAllText(bat, sb.ToString(), Encoding.Default);

            Process.Start(new ProcessStartInfo("cmd.exe", "/c \"" + bat + "\"")
            {
                CreateNoWindow = true,
                UseShellExecute = false
            });
            Application.Exit();
        }
    }
}
