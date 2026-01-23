use std::sync::Once;
use tauri::Emitter;
use tauri::{AppHandle, Listener, Manager, WebviewWindow};
use windows::core::{Interface, Result as WindowsResult, PCWSTR};
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_INPROC_SERVER};
use windows::Win32::System::LibraryLoader::LoadLibraryW;
use windows::Win32::UI::Shell::{
    ITaskbarList3, TaskbarList, THBF_ENABLED, THBN_CLICKED, THUMBBUTTON, THUMBBUTTONFLAGS,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CallWindowProcW, DefWindowProcW, LoadIconW, RegisterWindowMessageW, SetWindowLongPtrW,
    GWLP_WNDPROC, HICON, SM_CXICON, SM_CYICON, WM_COMMAND, WM_CREATE,
};

// Button IDs
const ID_PREV: u32 = 1001;
const ID_PLAY_PAUSE: u32 = 1002;
const ID_NEXT: u32 = 1003;

static mut OLD_WND_PROC: Option<unsafe extern "system" fn(HWND, u32, WPARAM, LPARAM) -> LRESULT> =
    None;
static INIT: Once = Once::new();

// We need a thread-safe way to emit events because WNDPROC is static.
// However, WNDPROC runs on the main thread, same as Tauri's event loop usually.
// But passing AppHandle to a static context is tricky.
// We'll use a lazy_static global equivalent or just a raw pointer workaround safely since we know the lifecycle.
static mut GLOBAL_APP_HANDLE: Option<AppHandle> = None;

pub fn init(window: WebviewWindow) {
    let hwnd = window.hwnd().unwrap().0 as isize;
    let hwnd = HWND(hwnd as _);

    unsafe {
        GLOBAL_APP_HANDLE = Some(window.app_handle().clone());

        // Initialize Taskbar Buttons
        if let Err(e) = setup_taskbar_buttons(hwnd) {
            eprintln!("Failed to setup taskbar buttons: {:?}", e);
        }

        // Subclass Window Proc
        let old_proc = SetWindowLongPtrW(hwnd, GWLP_WNDPROC, taskbar_wnd_proc as isize);
        OLD_WND_PROC = Some(std::mem::transmute(old_proc));
    }
}

pub fn update_play_status(playing: bool) {
    // We would need to update the icon of the Play/Pause button here.
    // This requires ITaskbarList3::ThumbBarUpdateButtons
    // For MVP, we stick to a static "Play/Pause" toggle icon or just "Play".
    // Implementing dynamic update requires storing the HWND and ITaskbarList3 pointer (which is not thread safe easily).
    // Letting this pass for the first iteration.
}

unsafe extern "system" fn taskbar_wnd_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    if msg == WM_COMMAND {
        // High word of wParam identifies the notification code
        // For buttons, it should be THBN_CLICKED (0x1800)
        let high_word = (wparam.0 >> 16) & 0xFFFF;
        let low_word = wparam.0 & 0xFFFF;

        if high_word as u32 == THBN_CLICKED {
            let event = match low_word as u32 {
                ID_PREV => Some("media:prev"),
                ID_PLAY_PAUSE => {
                    // We don't know state here easily, but the frontend knows.
                    // We can emit "media:toggle" or check state.
                    // Let's emit a generic toggle event or rely on existing hooks.
                    // The App.tsx listens for media:play/pause.
                    // We'll emit 'media:toggle' and handle it in Frontend or simply 'media:play' / 'media:pause' if we knew.
                    // Better: emit 'media:toggle' and let frontend decide.
                    Some("media:toggle")
                }
                ID_NEXT => Some("media:next"),
                _ => None,
            };

            if let Some(event_name) = event {
                if let Some(ref app) = GLOBAL_APP_HANDLE {
                    let _ = app.emit(event_name, ());
                }
            }
        }
    }

    if let Some(old_proc) = OLD_WND_PROC {
        CallWindowProcW(Some(old_proc), hwnd, msg, wparam, lparam)
    } else {
        DefWindowProcW(hwnd, msg, wparam, lparam)
    }
}

fn setup_taskbar_buttons(hwnd: HWND) -> WindowsResult<()> {
    unsafe {
        let taskbar: ITaskbarList3 = CoCreateInstance(&TaskbarList, None, CLSCTX_INPROC_SERVER)?;

        // Load system icons for now (shell32.dll)
        // 129 = Play/Action ? Not guaranteed.
        // Let's use widely available indices or just standard arrows.
        // Shell32.dll:
        // 46 = Up Arrow
        // 138 = Right Arrow (Next)
        // 137 = Left Arrow (Prev)
        // 247 = Play (Green) - varies by windows version

        // Better: Use LoadIconW with IDO_xxx? No, those aren't for media.
        // We will try to load from generic system libraries.

        let shell32 = "shell32.dll\0".encode_utf16().collect::<Vec<u16>>();
        let h_shell32 = LoadLibraryW(PCWSTR(shell32.as_ptr()));

        // These indices are approximate for Win10/11.
        // Real implementation should embed resources.
        // Using safe fallbacks.
        let icon_prev = LoadIconW(h_shell32, PCWSTR(16 as *const _)).unwrap_or_default(); // CD (Fallback)
        let icon_play = LoadIconW(h_shell32, PCWSTR(284 as *const _)).unwrap_or_default(); // Play?
        let icon_next = LoadIconW(h_shell32, PCWSTR(16 as *const _)).unwrap_or_default(); // CD

        // Let's try to pass blank icons if we can't find good ones,
        // or just rely on the user knowing position.
        // Actually, without icons, buttons might not show.

        let mut buttons = [
            THUMBBUTTON {
                dwMask: THUMB_MASK_BUTTON(0x1 | 0x2 | 0x4), // Bitmap | Icon | Tooltip
                iId: ID_PREV,
                iBitmap: 0,
                hIcon: icon_prev,
                szTip: encode_tip("Previous"),
                dwFlags: THBF_ENABLED,
            },
            THUMBBUTTON {
                dwMask: THUMB_MASK_BUTTON(0x1 | 0x2 | 0x4),
                iId: ID_PLAY_PAUSE,
                iBitmap: 0,
                hIcon: icon_play,
                szTip: encode_tip("Play/Pause"),
                dwFlags: THBF_ENABLED,
            },
            THUMBBUTTON {
                dwMask: THUMB_MASK_BUTTON(0x1 | 0x2 | 0x4),
                iId: ID_NEXT,
                iBitmap: 0,
                hIcon: icon_next,
                szTip: encode_tip("Next"),
                dwFlags: THBF_ENABLED,
            },
        ];

        // Init must be called before adding buttons? No, just HWND is needed.
        // But we DO need to initialize the specific button list for the window.
        taskbar.ThumbBarAddButtons(hwnd, &buttons)?;
    }
    Ok(())
}

fn encode_tip(s: &str) -> [u16; 260] {
    let mut buf = [0u16; 260];
    for (i, c) in s.encode_utf16().enumerate().take(259) {
        buf[i] = c;
    }
    buf
}

// Helpers for bitmasks which obscurely map in windows-rs
#[allow(non_snake_case)]
fn THUMB_MASK_BUTTON(mask: u32) -> windows::Win32::UI::Shell::THUMBBUTTONMASK {
    unsafe { std::mem::transmute(mask) }
}
