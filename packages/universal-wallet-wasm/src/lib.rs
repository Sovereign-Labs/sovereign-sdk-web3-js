use sov_universal_wallet::schema::Schema as NativeSchema;
use wasm_bindgen::prelude::*;

trait MapErrorToJs<T> {
    fn map_err_to_js(self) -> Result<T, JsValue>;
}

impl<T, E> MapErrorToJs<T> for Result<T, E>
where
    E: std::fmt::Debug,
{
    fn map_err_to_js(self) -> Result<T, JsValue> {
        self.map_err(|e| JsValue::from_str(format!("{:?}", e).as_str()))
    }
}

#[wasm_bindgen]
pub struct Schema(NativeSchema);

#[wasm_bindgen]
impl Schema {
    /// Creates a `Schema` instance from the provided JSON descriptor.
    #[wasm_bindgen(js_name = fromJSON)]
    pub fn from_json(json: &str) -> Result<Schema, JsValue> {
        Ok(Self(NativeSchema::from_json(json).map_err_to_js()?))
    }

    /// Converts the provided JSON to borsh according to the provided schema.
    #[wasm_bindgen(js_name = jsonToBorsh)]
    pub fn json_to_borsh(&self, input: &str) -> Result<Vec<u8>, JsValue> {
        Ok(self.0.json_to_borsh(input).map_err_to_js()?)
    }

    /// Displays the provided borsh bytes as a string according to the provided schema.
    pub fn display(&self, input: &[u8]) -> Result<String, JsValue> {
        Ok(self.0.display(input).map_err_to_js()?)
    }
}
