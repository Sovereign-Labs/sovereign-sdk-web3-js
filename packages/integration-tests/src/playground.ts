// just a file to run and test stuff
// run with `pnpm run playground`
import { getSigner, addressFromPublicKey } from "./tests/signer.js";

const signer = getSigner();
const publicKey = await signer.publicKey();
console.log(addressFromPublicKey(publicKey));
