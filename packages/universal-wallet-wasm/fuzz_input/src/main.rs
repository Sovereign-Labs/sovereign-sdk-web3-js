use arbitrary::{Arbitrary, Unstructured};
use rand::Rng;
use sov_modules_api::macros::UniversalWallet;
use sov_modules_api::prelude::serde::{Deserialize, Serialize};
use sov_modules_api::SafeString;
use sov_universal_wallet::schema::safe_string::DEFAULT_MAX_STRING_LENGTH;
use sov_universal_wallet::schema::Schema;

// arbitrary isn't implemented for safe string
#[derive(Serialize, Deserialize, UniversalWallet)]
struct ArbitrarySafeString(SafeString);

impl Arbitrary<'_> for ArbitrarySafeString {
    fn arbitrary(u: &mut Unstructured<'_>) -> arbitrary::Result<Self> {
        let min_len = DEFAULT_MAX_STRING_LENGTH / 2;
        let len = u.int_in_range(min_len..=DEFAULT_MAX_STRING_LENGTH)?;

        let chars: Result<String, _> = (0..len)
            .map(|_| {
                let c = u.int_in_range(32u8..=126u8)? as char;
                Ok(c)
            })
            .collect();

        let s = chars?;
        Ok(ArbitrarySafeString(s.try_into().unwrap()))
    }
}

#[derive(Serialize, Deserialize, UniversalWallet)]
struct LargeVec(Vec<u8>);

impl Arbitrary<'_> for LargeVec {
    fn arbitrary(u: &mut Unstructured<'_>) -> arbitrary::Result<Self> {
        // Generate vectors with 10-100 elements
        let len = u.int_in_range(5..=100)?;
        let mut vec = Vec::with_capacity(len);
        for _ in 0..len {
            vec.push(u8::arbitrary(u)?);
        }
        Ok(LargeVec(vec))
    }
}

#[derive(Serialize, Deserialize, UniversalWallet, Arbitrary)]
enum ByteInput {
    Hex(#[sov_wallet(display(hex))] LargeVec),
    Base58(#[sov_wallet(display(base58))] LargeVec),
    Decimal(#[sov_wallet(display(decimal))] LargeVec),
}

#[derive(Serialize, Deserialize, UniversalWallet, Arbitrary)]
enum NumberInput {
    U8(u8),
    U16(u16),
    U32(u32),
    U64(u64),
    U128(u128),
}

#[derive(Serialize, Deserialize, UniversalWallet, Arbitrary)]
enum FuzzInput {
    String(ArbitrarySafeString),
    Byte(ByteInput),
    Number(NumberInput),
}

fn generate_schema() -> Result<String, Box<dyn std::error::Error>> {
    let schema = Schema::of_single_type::<FuzzInput>()
        .map_err(|e| format!("Failed to generate schema: {:?}", e))?;
    Ok(serde_json::to_string_pretty(&schema)?)
}

fn generate_input() -> Result<String, Box<dyn std::error::Error>> {
    let mut rng = rand::thread_rng();
    let mut data = vec![0u8; 4096];
    rng.fill(&mut data[..]);

    let mut u = Unstructured::new(&data);
    let input =
        FuzzInput::arbitrary(&mut u).map_err(|e| format!("Failed to generate input: {:?}", e))?;

    Ok(serde_json::to_string_pretty(&input)?)
}

fn main() {
    let args: Vec<String> = std::env::args().collect();

    if args.len() > 1 && args[1] == "schema" {
        match generate_schema() {
            Ok(schema) => println!("{}", schema),
            Err(e) => {
                eprintln!("Error generating schema: {}", e);
                std::process::exit(1);
            }
        }
    } else {
        match generate_input() {
            Ok(input) => println!("{}", input),
            Err(e) => {
                eprintln!("Error generating input: {}", e);
                std::process::exit(1);
            }
        }
    }
}
