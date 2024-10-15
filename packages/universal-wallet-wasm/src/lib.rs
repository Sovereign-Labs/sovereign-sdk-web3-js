use sov_universal_wallet::schema::{RollupRoots, Schema as NativeSchema};
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
pub enum KnownTypeId {
    Transaction = 0,
    UnsignedTransaction = 1,
    RuntimeCall = 2,
}

impl From<KnownTypeId> for RollupRoots {
    fn from(value: KnownTypeId) -> Self {
        match value {
            KnownTypeId::Transaction => RollupRoots::Transaction,
            KnownTypeId::UnsignedTransaction => RollupRoots::UnsignedTransaction,
            KnownTypeId::RuntimeCall => RollupRoots::RuntimeCall,
        }
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
    pub fn json_to_borsh(&self, type_index: usize, input: &str) -> Result<Vec<u8>, JsValue> {
        self.0.json_to_borsh(type_index, input).map_err_to_js()
    }

    /// Displays the provided borsh bytes as a string according to the provided schema.
    pub fn display(&self, type_index: usize, input: &[u8]) -> Result<String, JsValue> {
        self.0.display(type_index, input).map_err_to_js()
    }

    /// Get the index of the provided known type within the schema.
    #[wasm_bindgen(js_name = knownTypeIndex)]
    pub fn known_type_index(&self, known_type_id: KnownTypeId) -> Result<usize, JsValue> {
        self.0
            .rollup_expected_index(known_type_id.into())
            .map_err_to_js()
    }
}
