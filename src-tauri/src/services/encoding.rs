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

    if let Some((enc, _bom_len)) = encoding_rs::Encoding::for_bom(&buf) {
        return Ok(enc.name().to_string());
    }

    let candidates = ["GB18030", "GBK", "Big5", "EUC-JP", "Shift_JIS", "windows-1252"];

    let mut best_encoding = "UTF-8".to_string();
    let mut best_errors = usize::MAX;

    for label in &candidates {
        if let Some(enc) = encoding_rs::Encoding::for_label(label.as_bytes()) {
            let (text, _, _) = enc.decode(&buf);
            let errors = text.chars().filter(|&c| c == '\u{FFFD}').count();
            if errors == 0 {
                return Ok(enc.name().to_string());
            }
            if errors < best_errors {
                best_errors = errors;
                best_encoding = enc.name().to_string();
            }
        }
    }

    if best_errors == usize::MAX {
        Ok("UTF-8".to_string())
    } else {
        Ok(best_encoding)
    }
}

pub fn encode_to(text: &str, encoding_name: &str) -> Result<Vec<u8>, String> {
    let enc = encoding_rs::Encoding::for_label(encoding_name.as_bytes())
        .ok_or_else(|| format!("Unknown encoding: {encoding_name}"))?;
    let (bytes, _, _) = enc.encode(text);
    Ok(bytes.into_owned())
}
