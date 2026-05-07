use std::io::Read;
use std::path::Path;

pub fn detect_encoding(path: &Path) -> Result<String, String> {
    let mut file =
        std::fs::File::open(path).map_err(|e| format!("Failed to open file for encoding detection: {e}"))?;

    let mut buf = vec![0u8; 65536];
    let n = file
        .read(&mut buf)
        .map_err(|e| format!("Failed to read file for encoding detection: {e}"))?;
    buf.truncate(n);

    if buf.is_empty() {
        return Ok("UTF-8".to_string());
    }

    // 1. BOM detection
    if let Some((enc, _)) = encoding_rs::Encoding::for_bom(&buf) {
        return Ok(enc.name().to_string());
    }

    // 2. Fast path: valid UTF-8 → UTF-8 (vast majority of modern text files)
    if std::str::from_utf8(&buf).is_ok() {
        return Ok("UTF-8".to_string());
    }

    // 3. Score CJK encodings.
    //
    // windows-1252 is handled separately (step 4) because every byte 0x00-0xFF
    // is valid in windows-1252, making error-counting useless for distinguishing it.
    //
    // Real-world CJK files may have a tiny number of decoder errors (e.g. private-use
    // bytes, rare extensions) while still being overwhelmingly CJK text. We use a
    // tolerance threshold instead of requiring zero errors, and verify by checking
    // the decoded output contains actual CJK ideographs.
    const CJK_ERROR_TOLERANCE: usize = 10;
    let cjk_candidates = ["GB18030", "GBK", "Big5", "EUC-JP", "Shift_JIS"];

    let mut best_cjk: Option<(&str, usize)> = None;

    for &label in &cjk_candidates {
        if let Some(enc) = encoding_rs::Encoding::for_label(label.as_bytes()) {
            let (text, _, _) = enc.decode(&buf);
            let errors = text.chars().filter(|&c| c == '\u{FFFD}').count();

            if errors <= CJK_ERROR_TOLERANCE {
                let has_cjk = text.chars().any(|c| (c as u32) >= 0x4E00 && (c as u32) <= 0x9FFF);
                if has_cjk {
                    match best_cjk {
                        None => best_cjk = Some((label, errors)),
                        Some((_, best_err)) if errors < best_err => best_cjk = Some((label, errors)),
                        _ => {}
                    }
                }
            }
        }
    }

    if let Some((label, _)) = best_cjk {
        return Ok(label.to_string());
    }

    // 4. Not valid UTF-8 and no CJK encoding produces a meaningful result.
    // Every byte is valid in windows-1252, making it the best fallback for
    // non-CJK, non-UTF-8 text files.
    Ok("windows-1252".to_string())
}

pub fn encode_to(text: &str, encoding_name: &str) -> Result<Vec<u8>, String> {
    let enc = encoding_rs::Encoding::for_label(encoding_name.as_bytes())
        .ok_or_else(|| format!("Unknown encoding: {encoding_name}"))?;
    let (bytes, _, _) = enc.encode(text);
    Ok(bytes.into_owned())
}
