#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// ══════════════════════════════════════════════════════════════
// list_printers — يرجع أسماء الطابعات المثبتة على الجهاز
// يدعم Windows (wmic) و macOS/Linux (lpstat)
// ══════════════════════════════════════════════════════════════
#[tauri::command]
fn list_printers() -> Vec<String> {
    #[cfg(target_os = "windows")]
    {
        let output = std::process::Command::new("wmic")
            .args(["printer", "get", "name", "/format:list"])
            .output();
        match output {
            Ok(o) => String::from_utf8_lossy(&o.stdout)
                .lines()
                .filter_map(|l| {
                    let l = l.trim();
                    if l.starts_with("Name=") {
                        let name = l.trim_start_matches("Name=").trim().to_string();
                        if !name.is_empty() { Some(name) } else { None }
                    } else {
                        None
                    }
                })
                .collect(),
            Err(_) => vec![],
        }
    }

    #[cfg(target_os = "macos")]
    {
        let output = std::process::Command::new("lpstat")
            .args(["-p"])
            .output();
        match output {
            Ok(o) => String::from_utf8_lossy(&o.stdout)
                .lines()
                .filter_map(|l| {
                    // "printer HP_LaserJet is idle."
                    let parts: Vec<&str> = l.split_whitespace().collect();
                    if parts.first() == Some(&"printer") {
                        parts.get(1).map(|s| s.replace("_", " "))
                    } else {
                        None
                    }
                })
                .collect(),
            Err(_) => vec![],
        }
    }

    #[cfg(target_os = "linux")]
    {
        let output = std::process::Command::new("lpstat")
            .args(["-p"])
            .output();
        match output {
            Ok(o) => String::from_utf8_lossy(&o.stdout)
                .lines()
                .filter_map(|l| {
                    let parts: Vec<&str> = l.split_whitespace().collect();
                    if parts.first() == Some(&"printer") {
                        parts.get(1).map(|s| s.replace("_", " "))
                    } else {
                        None
                    }
                })
                .collect(),
            Err(_) => vec![],
        }
    }

    // fallback لأي platform مش محدد
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        vec![]
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![list_printers])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
