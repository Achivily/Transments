use std::cmp::Ordering;
use std::collections::HashSet;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::MediaKind;

pub const IMAGE_INPUT: &[&str] = &[
    "png", "jpg", "jpeg", "webp", "tif", "tiff", "avif", "gif", "bmp", "heic", "heif",
];

pub const VIDEO_INPUT: &[&str] = &[
    "mp4", "m4v", "mkv", "mov", "webm", "avi", "flv", "wmv", "ts", "mts", "m2ts", "mpg", "mpeg",
    "3gp", "ogv", "gif",
];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FileItem {
    pub path: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub relative_path: Option<String>,
    #[serde(default)]
    pub size: u64,
}

pub fn extension(path: &Path) -> String {
    path.extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default()
}

pub fn is_supported(kind: MediaKind, ext: &str) -> bool {
    match kind {
        MediaKind::Image => IMAGE_INPUT.contains(&ext),
        MediaKind::Video | MediaKind::Compress => VIDEO_INPUT.contains(&ext),
    }
}

/// `filter` is "auto" / empty, or a dotted extension that may stand for a family
/// (".jpg" also matches .jpeg, ".ts" also matches .mts/.m2ts, ...).
pub fn format_matches(ext: &str, filter: Option<&str>) -> bool {
    let filter = match filter {
        None | Some("") | Some("auto") => return true,
        Some(f) => f.trim_start_matches('.').to_lowercase(),
    };
    let family: &[&str] = match filter.as_str() {
        "jpg" => &["jpg", "jpeg"],
        "tif" => &["tif", "tiff"],
        "heic" => &["heic", "heif"],
        "mp4" => &["mp4", "m4v"],
        "ts" => &["ts", "mts", "m2ts"],
        "mpg" => &["mpg", "mpeg"],
        _ => return ext == filter,
    };
    family.contains(&ext)
}

fn display(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

pub fn scan_folder(
    kind: MediaKind,
    folder: &Path,
    filter: Option<&str>,
    recursive: bool,
) -> io::Result<Vec<FileItem>> {
    let mut files = Vec::new();
    scan_into(kind, folder, folder, filter, recursive, &mut files)?;
    files.sort_by(|a, b| natural_cmp(sort_key(a), sort_key(b)));
    Ok(files)
}

fn scan_into(
    kind: MediaKind,
    dir: &Path,
    root: &Path,
    filter: Option<&str>,
    recursive: bool,
    out: &mut Vec<FileItem>,
) -> io::Result<()> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let full = entry.path();
        if file_type.is_dir() {
            if recursive {
                scan_into(kind, &full, root, filter, true, out)?;
            }
            continue;
        }
        if !file_type.is_file() {
            continue;
        }
        let ext = extension(&full);
        if !is_supported(kind, &ext) || !format_matches(&ext, filter) {
            continue;
        }
        let relative = full.strip_prefix(root).map(PathBuf::from).unwrap_or_else(|_| full.clone());
        out.push(FileItem {
            name: entry.file_name().to_string_lossy().into_owned(),
            relative_path: Some(display(&relative)),
            size: entry.metadata().map(|m| m.len()).unwrap_or(0),
            path: display(&full),
        });
    }
    Ok(())
}

/// Turns dropped / picked paths (files or folders) into a de-duplicated queue.
pub fn resolve_paths(
    kind: MediaKind,
    inputs: &[String],
    filter: Option<&str>,
    recursive: bool,
) -> Vec<FileItem> {
    let mut files = Vec::new();
    let mut seen = HashSet::new();
    for input in inputs {
        if input.is_empty() || seen.contains(&input.to_lowercase()) {
            continue;
        }
        let path = Path::new(input);
        let Ok(meta) = fs::metadata(path) else { continue };
        if meta.is_dir() {
            let Ok(scanned) = scan_folder(kind, path, filter, recursive) else { continue };
            for file in scanned {
                if seen.insert(file.path.to_lowercase()) {
                    files.push(file);
                }
            }
            continue;
        }
        if !meta.is_file() {
            continue;
        }
        let ext = extension(path);
        if !is_supported(kind, &ext) || !format_matches(&ext, filter) {
            continue;
        }
        seen.insert(input.to_lowercase());
        files.push(FileItem {
            path: input.clone(),
            name: path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default(),
            relative_path: None,
            size: meta.len(),
        });
    }
    files.sort_by(|a, b| natural_cmp(sort_key(a), sort_key(b)));
    files
}

pub fn file_item(path: &str) -> io::Result<FileItem> {
    let meta = fs::metadata(path)?;
    Ok(FileItem {
        path: path.to_string(),
        name: Path::new(path).file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default(),
        relative_path: None,
        size: meta.len(),
    })
}

fn sort_key(file: &FileItem) -> &str {
    file.relative_path.as_deref().unwrap_or(&file.name)
}

/// Case-insensitive ordering where digit runs compare by value ("img2" < "img10").
pub fn natural_cmp(a: &str, b: &str) -> Ordering {
    let (mut a, mut b) = (a.chars().peekable(), b.chars().peekable());
    loop {
        match (a.peek().copied(), b.peek().copied()) {
            (None, None) => return Ordering::Equal,
            (None, Some(_)) => return Ordering::Less,
            (Some(_), None) => return Ordering::Greater,
            (Some(x), Some(y)) if x.is_ascii_digit() && y.is_ascii_digit() => {
                let take = |it: &mut std::iter::Peekable<std::str::Chars>| {
                    let mut s = String::new();
                    while let Some(c) = it.peek().copied().filter(char::is_ascii_digit) {
                        s.push(c);
                        it.next();
                    }
                    s
                };
                let (na, nb) = (take(&mut a), take(&mut b));
                let (ta, tb) = (na.trim_start_matches('0'), nb.trim_start_matches('0'));
                let ord = ta.len().cmp(&tb.len()).then_with(|| ta.cmp(tb));
                if ord != Ordering::Equal {
                    return ord;
                }
            }
            (Some(x), Some(y)) => {
                let ord = x.to_lowercase().cmp(y.to_lowercase()).then(Ordering::Equal);
                if ord != Ordering::Equal {
                    return ord;
                }
                a.next();
                b.next();
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn natural_order() {
        let mut v = vec!["img10.png", "img2.png", "Img1.png", "a/b.png"];
        v.sort_by(|a, b| natural_cmp(a, b));
        assert_eq!(v, ["a/b.png", "Img1.png", "img2.png", "img10.png"]);
    }

    #[test]
    fn families() {
        assert!(format_matches("jpeg", Some(".jpg")));
        assert!(format_matches("m2ts", Some(".ts")));
        assert!(!format_matches("png", Some(".jpg")));
        assert!(format_matches("png", Some("auto")));
    }
}
