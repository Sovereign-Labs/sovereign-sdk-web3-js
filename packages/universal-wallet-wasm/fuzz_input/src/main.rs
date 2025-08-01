use arbitrary::{Arbitrary, Unstructured};
use rand::Rng;
use sov_modules_api::macros::UniversalWallet;
use sov_modules_api::prelude::serde::{Deserialize, Serialize};
use sov_modules_api::SafeString;
use sov_universal_wallet::schema::safe_string::DEFAULT_MAX_STRING_LENGTH;
use sov_universal_wallet::schema::Schema;

const JS_MAX_SAFE_INTEGER: u128 = 9_007_199_254_740_991;
const JS_MIN_SAFE_INTEGER: i128 = -9_007_199_254_740_991;

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
struct LargeVec<T>(Vec<T>);

impl<T> Arbitrary<'_> for LargeVec<T>
where
    T: for<'a> Arbitrary<'a>,
{
    fn arbitrary(u: &mut Unstructured<'_>) -> arbitrary::Result<Self> {
        let len = u.int_in_range(5..=100)?;
        let mut vec = Vec::with_capacity(len);
        for _ in 0..len {
            vec.push(T::arbitrary(u)?);
        }
        Ok(LargeVec(vec))
    }
}

#[derive(Serialize, Deserialize, UniversalWallet, Arbitrary)]
enum ByteVecInput {
    Hex(#[sov_wallet(display(hex))] LargeVec<u8>),
    Base58(#[sov_wallet(display(base58))] LargeVec<u8>),
    Decimal(#[sov_wallet(display(decimal))] LargeVec<u8>),
}

#[derive(Serialize, Deserialize, UniversalWallet)]
struct U128String(SafeString);

#[derive(Serialize, Deserialize, UniversalWallet)]
enum SizedU128 {
    Small(u128),
    Large(U128String),
}

impl Arbitrary<'_> for SizedU128 {
    fn arbitrary(u: &mut Unstructured<'_>) -> arbitrary::Result<Self> {
        let value: u128 = u.arbitrary()?;

        if value > JS_MAX_SAFE_INTEGER {
            Ok(Self::Large(U128String(
                value.to_string().try_into().unwrap(),
            )))
        } else {
            Ok(Self::Small(value))
        }
    }
}

#[derive(Serialize, Deserialize, UniversalWallet)]
struct I128String(SafeString);

#[derive(Serialize, Deserialize, UniversalWallet)]
enum SizedI128 {
    Small(i128),
    Large(I128String), // This is ineffective we're actually just using a string schema not i128 as
                       // string
}

impl Arbitrary<'_> for SizedI128 {
    fn arbitrary(u: &mut Unstructured<'_>) -> arbitrary::Result<Self> {
        let value: i128 = u.arbitrary()?;

        if value < JS_MIN_SAFE_INTEGER || (value > 0 && value as u128 > JS_MAX_SAFE_INTEGER) {
            Ok(Self::Large(I128String(
                value.to_string().try_into().unwrap(),
            )))
        } else {
            Ok(Self::Small(value))
        }
    }
}

#[derive(Serialize, Deserialize, UniversalWallet)]
struct FiniteF32(f32);

impl Arbitrary<'_> for FiniteF32 {
    fn arbitrary(u: &mut Unstructured<'_>) -> arbitrary::Result<Self> {
        let val: f32 = u.arbitrary()?;

        let finite_val = if val.is_infinite() {
            if val.is_sign_positive() {
                f32::MAX
            } else {
                f32::MIN
            }
        } else if val.is_nan() {
            0.0
        } else {
            val
        };

        Ok(FiniteF32(finite_val))
    }
}

#[derive(Serialize, Deserialize, UniversalWallet, Arbitrary)]
enum NumberInput {
    U8(u8),
    U16(u16),
    U32(u32),
    U64(u64),
    U128(SizedU128),
    I8(i8),
    I16(i16),
    I32(i32),
    I64(i64),
    I128(SizedI128),
    F32(FiniteF32),
    // theres precision loss when converting the value from JSON string to f64 in rust
    // without the JSON conversion the serializations matches
    // F64(f64),
}

#[derive(Serialize, Deserialize, UniversalWallet, Arbitrary)]
enum FuzzInput {
    Bool(bool),
    String(ArbitrarySafeString),
    ByteVec(ByteVecInput),
    // Vec
    // Array
    // ByteArray
    // Map
    Number(NumberInput),
    InlineStruct {
        field: u32,
        name: ArbitrarySafeString,
    },
    MultiTuple(i8, Option<u8>),
    SkippedField {
        // borsh(skip)
        #[sov_wallet(skip)]
        skipper: u8,
        not_skipped: u8,
    },
}

fn generate_schema() -> Result<String, Box<dyn std::error::Error>> {
    let schema = Schema::of_single_type::<FuzzInput>()
        .map_err(|e| format!("Failed to generate schema: {:?}", e))?;
    Ok(serde_json::to_string_pretty(&schema)?)
}

fn generate_test_case() -> Result<String, Box<dyn std::error::Error>> {
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
        match generate_test_case() {
            Ok(input) => println!("{}", input),
            Err(e) => {
                eprintln!("Error generating input: {}", e);
                std::process::exit(1);
            }
        }
    }
}
