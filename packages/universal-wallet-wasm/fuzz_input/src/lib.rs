use sov_modules_api::macros::UniversalWallet;
use sov_modules_api::prelude::serde::{Serialize, Deserialize}
use sov_universal_wallet::schema::Schema;
use wasm_bindgen::prelude::*;

#[derive(Serialize, Deserialize, UniversalWallet)]
pub enum StringInput {
    Hex(String),
    Base58(String),
    Any(String),
}

#[derive(Serialize, Deserialize, UniversalWallet)]
pub enum FuzzInput {
    String(StringInput),
}

#[wasm_bindgen]
pub fn schema() -> Result<JsValue, JsValue> {
    let schema = Schema::of_single_type::<FuzzInput>().expect("Failed to generate schema");
    Ok(serde_wasm_bindgen::to_value(&schema)?)
}

#[wasm_bindgen]
pub fn generate_input() -> JsValue {
    todo!()
}
