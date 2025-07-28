use arbitrary::{Arbitrary, Unstructured};
use sov_modules_api::macros::UniversalWallet;
use sov_modules_api::prelude::serde::{Deserialize, Serialize};
use sov_modules_api::SafeString;
use sov_universal_wallet::schema::safe_string::DEFAULT_MAX_STRING_LENGTH;
use sov_universal_wallet::schema::Schema;
use wasm_bindgen::prelude::*;

// arbitrary isn't implemented for safe string
#[derive(Serialize, Deserialize, UniversalWallet)]
struct ArbitrarySafeString(SafeString);

impl Arbitrary<'_> for ArbitrarySafeString {
    fn arbitrary(u: &mut Unstructured<'_>) -> arbitrary::Result<Self> {
        let len = u.int_in_range(0..=DEFAULT_MAX_STRING_LENGTH)?;
        let s = String::arbitrary(u)?;

        let truncated = if s.len() > DEFAULT_MAX_STRING_LENGTH {
            s.chars().take(len).collect()
        } else {
            s
        };

        Ok(ArbitrarySafeString(truncated.try_into().unwrap()))
    }
}

#[derive(Serialize, Deserialize, UniversalWallet, Arbitrary)]
enum ByteInput {
    Hex(#[sov_wallet(display(hex))] Vec<u8>),
    Base58(#[sov_wallet(display(base58))] Vec<u8>),
    Decimal(#[sov_wallet(display(decimal))] Vec<u8>),
}

#[derive(Serialize, Deserialize, UniversalWallet, Arbitrary)]
enum FuzzInput {
    StringInput(ArbitrarySafeString),
    ByteInput(ByteInput),
}

#[wasm_bindgen]
pub fn schema() -> Result<JsValue, JsValue> {
    let schema = Schema::of_single_type::<FuzzInput>().expect("Failed to generate schema");
    Ok(serde_wasm_bindgen::to_value(&schema)?)
}

#[wasm_bindgen]
pub fn generate_input() -> Result<JsValue, JsValue> {
    let mut data = vec![0u8; 128];
    for byte in data.iter_mut() {
        *byte = (js_sys::Math::random() * 256.0) as u8;
    }

    let mut u = Unstructured::new(&data);
    let input = FuzzInput::arbitrary(&mut u)
        .map_err(|e| JsValue::from_str(&format!("Failed to generate input: {:?}", e)))?;

    serde_wasm_bindgen::to_value(&input)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize: {:?}", e)))
}
