#![cfg(target_os = "windows")]

use std::sync::Once;
use tauri::{AppHandle, Manager, WebviewWindow};
use windows::core::{Result as WindowsResult, PCWSTR};

use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_INPROC_SERVER};
use windows::Win32::System::LibraryLoader::LoadLibraryW;
// Needed for .hwnd() on WebviewWindow
use tauri::listener::Listener; // Wait, Listener? No.
                               // Try to include the trait if we can guess it. In Tauri 2 rc, it might be tauri::platform::windows::WindowExtWindows.
                               // Let's safe bet verify first? No, blind shot:
use tauri::platform::windows::WindowExtWindows;
use windows::Win32::UI::Shell::{
    ITaskbarList3, TaskbarList, THBF_ENABLED, THBN_CLICKED, THUMBBUTTON, THUMBBUTTONMASK,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CallWindowProcW, DefWindowProcW, LoadImageW, SetWindowLongPtrW, GWLP_WNDPROC, HICON,
    IMAGE_ICON, LR_DEFAULTSIZE, LR_LOADFROMFILE, WM_COMMAND,
};

// Button IDs
const ID_PREV: u32 = 1001;
const ID_PLAY_PAUSE: u32 = 1002;
const ID_NEXT: u32 = 1003;

static mut OLD_WND_PROC: Option<unsafe extern "system" fn(HWND, u32, WPARAM, LPARAM) -> LRESULT> =
    None;
static INIT: Once = Once::new();

static mut GLOBAL_APP_HANDLE: Option<AppHandle> = None;
static mut GLOBAL_WINDOW_HANDLE: HWND = HWND(std::ptr::null_mut());

// Store icons globally so we can update them
static mut ICON_BACK: HICON = HICON(std::ptr::null_mut());
static mut ICON_PLAY: HICON = HICON(std::ptr::null_mut());
static mut ICON_PAUSE: HICON = HICON(std::ptr::null_mut());
static mut ICON_NEXT: HICON = HICON(std::ptr::null_mut());

// Cache current playing state to avoid redundant updates
static mut IS_PLAYING: bool = false;

pub fn init(window: WebviewWindow) {
    let hwnd_isize = window.hwnd().unwrap().0 as isize;
    let hwnd = HWND(hwnd_isize as _);

    unsafe {
        GLOBAL_APP_HANDLE = Some(window.app_handle().clone());
        GLOBAL_WINDOW_HANDLE = hwnd;

        // Initialize Taskbar Buttons
        if let Err(e) = setup_taskbar_buttons(hwnd, window.app_handle()) {
            eprintln!("Failed to setup taskbar buttons: {:?}", e);
        }

        // Subclass Window Proc
        let old_proc = SetWindowLongPtrW(hwnd, GWLP_WNDPROC, taskbar_wnd_proc as isize);
        OLD_WND_PROC = Some(std::mem::transmute(old_proc));
    }
}

pub fn update_play_status(playing: bool) {
    unsafe {
        if IS_PLAYING == playing {
            return;
        }
        IS_PLAYING = playing;

        let hwnd = GLOBAL_WINDOW_HANDLE;
        if hwnd.0.is_null() {
            return;
        }

        // We need to create ITaskbarList3 each time (it's cheap) or store it?
        // Usually creating it is fine.
        if let Ok(taskbar) =
            CoCreateInstance::<_, ITaskbarList3>(&TaskbarList, None, CLSCTX_INPROC_SERVER)
        {
            let icon = if playing { ICON_PAUSE } else { ICON_PLAY };

            let button = THUMBBUTTON {
                dwMask: THUMB_MASK_BUTTON(0x2), // THB_ICON
                iId: ID_PLAY_PAUSE,
                iBitmap: 0,
                hIcon: icon,
                szTip: encode_tip(if playing { "Pause" } else { "Play" }),
                dwFlags: THBF_ENABLED,
            };

            // Only update the specific button
            // Note: ThumbBarUpdateButtons takes an array.
            // If we just want to update one, we pass an array with just that one, but we MUST specify iId correctly.
            let _ = taskbar.ThumbBarUpdateButtons(hwnd, &[button]);
        }
    }
}

unsafe extern "system" fn taskbar_wnd_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    if msg == WM_COMMAND {
        let high_word = (wparam.0 >> 16) & 0xFFFF;
        let low_word = wparam.0 & 0xFFFF;

        if high_word as u32 == THBN_CLICKED {
            // Manually toggle icon immediately for responsiveness, though the event loop will eventually call update_play_status
            // Actually, let's wait for the state update from backend to ensure partial synchronization.

            let event = match low_word as u32 {
                ID_PREV => Some("media:prev"),
                ID_PLAY_PAUSE => Some("media:toggle"),
                ID_NEXT => Some("media:next"),
                _ => None,
            };

            if let Some(event_name) = event {
                // If it's the toggle button, we can optimistically flip the icon?
                // if event_name == "media:toggle" {
                //      update_play_status(!IS_PLAYING);
                // }

                if let Some(ref app) = GLOBAL_APP_HANDLE {
                    use tauri::Emitter;
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

fn setup_taskbar_buttons(hwnd: HWND, app_handle: &AppHandle) -> WindowsResult<()> {
    unsafe {
        let taskbar: ITaskbarList3 = CoCreateInstance(&TaskbarList, None, CLSCTX_INPROC_SERVER)?;

        // Function to load icon from resource path
        let load_icon = |name: &str| -> HICON {
            // Resolve resource path
            // In dev mode, resources are in the project folder.
            // In build, they are in the resource structure.
            // Tauri's path_resolver.resource_dir() gives us a BaseDirectory::Resource equivalent.

            // Note: In Tauri v2, app.path().resolve(..., BaseDirectory::Resource)
            use tauri::path::BaseDirectory;

            let path_result = app_handle
                .path()
                .resolve(format!("icons/{}", name), BaseDirectory::Resource);

            if let Ok(path) = path_result {
                // Convert PathBuf to null-terminated wide string
                let path_str = path.to_string_lossy();
                let mut wide_path: Vec<u16> = path_str.encode_utf16().collect();
                wide_path.push(0);

                let handle = LoadImageW(
                    None, // Load from file
                    PCWSTR(wide_path.as_ptr()),
                    IMAGE_ICON,
                    0,
                    0,
                    LR_LOADFROMFILE | LR_DEFAULTSIZE,
                );

                match handle {
                    Ok(h) => std::mem::transmute(h),
                    Err(_) => HICON(std::ptr::null_mut()),
                }
            } else {
                HICON(std::ptr::null_mut())
            }
        };

        // Load our custom icons
        ICON_BACK = load_icon("back.ico");
        ICON_PLAY = load_icon("play.ico");
        ICON_PAUSE = load_icon("pause.ico");
        ICON_NEXT = load_icon("next.ico");

        // Fallback for Play/Pause if loading failed?
        // If file not found, HICON is 0 (null), which shows empty space.
        // Ideally we should have error handling or fallback to system icons, but let's assume files exist.

        let buttons = [
            THUMBBUTTON {
                dwMask: THUMB_MASK_BUTTON(0x1 | 0x2 | 0x4), // Bitmap | Icon | Tooltip
                iId: ID_PREV,
                iBitmap: 0,
                hIcon: ICON_BACK,
                szTip: encode_tip("Previous"),
                dwFlags: THBF_ENABLED,
            },
            THUMBBUTTON {
                dwMask: THUMB_MASK_BUTTON(0x1 | 0x2 | 0x4),
                iId: ID_PLAY_PAUSE,
                iBitmap: 0,
                hIcon: ICON_PLAY, // Default to Play
                szTip: encode_tip("Play"),
                dwFlags: THBF_ENABLED,
            },
            THUMBBUTTON {
                dwMask: THUMB_MASK_BUTTON(0x1 | 0x2 | 0x4),
                iId: ID_NEXT,
                iBitmap: 0,
                hIcon: ICON_NEXT,
                szTip: encode_tip("Next"),
                dwFlags: THBF_ENABLED,
            },
        ];

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

#[allow(non_snake_case)]
fn THUMB_MASK_BUTTON(mask: u32) -> THUMBBUTTONMASK {
    unsafe { std::mem::transmute(mask) }
}
