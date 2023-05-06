// const openpgp = require("openpgp");
// const fs = require("fs")

// generate()
// async function generate() {
//   const { privateKey, publicKey } = await openpgp.generateKey({
//     type: 'rsa',
//     rsaBits: 4096,
//     userIDs: [{ name: 'empinosupplier', email: 'jayraldempino@gmail.com' }]
//   })

//   const pkey = await openpgp.readKey({ armoredKey: publicKey });
//   const pvkey = await openpgp.readPrivateKey({ armoredKey: privateKey })

//   const readableStream = new ReadableStream({
//     start(controller) {
//       controller.enqueue(JSON.stringify(Buffer.from("sample").toJSON().data));
//       controller.close();
//     }
//   });

//   const encrypted = await openpgp.encrypt({
//     message: await openpgp.createMessage({ text: readableStream }),
//     encryptionKeys: pkey
//   })

//   const reader = encrypted.getReader();
//   let enc = "";
//   for (; ;) {
//     let value = await reader.read();
//     if (value.done) break;
//     enc += value.value
//   }

//   const message = await openpgp.readMessage({
//     armoredMessage: enc // parse armored message
//   });
//   const decrypted = await openpgp.decrypt({
//     message,
//     decryptionKeys: pvkey
//   });

//   const chunks = [];
//   for await (const chunk of decrypted.data) {
//     chunks.push(chunk);
//   }

//   const plaintext = chunks.join('');
//   console.log(Buffer.from(JSON.parse(plaintext)).toString());

// }

// // sample()
// // async function sample() {
// //   const encrypted = await openpgp.encrypt({
// //     message: await openpgp.createMessage({
// //       text: `-----BEGIN PRIVATE KEY-----
// // MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQCkGfjz2gFwIlMR
// // ScJycv77me/nxi8Y31nXNjwGwyc6kUpnVC7WXLoNTKDoY25b7Tz+sCo1NlZo4Cto
// // 4zVIjYCenIYJmGwn8lDdCs7bWfKYEgTQmKuhPC6/YLvbng+fDTCmaeqlJU2XWZNp
// // reRED/tpdtFCbZr00XYOfNUe95d5t1HSIVzqtg6WAgGPSNKpEWnfFAMFe9U9Qtzq
// // dEaMzGQZN3O8Sw9r8OiiRTDd/Bq4TVJgzcIX7O53ysPc4itudGfieP+J5DvCXbMx
// // cflnKTWKuA5CJNhBQCgsKRBUinq1hsQjbgfmsVmDT7oA6amEvLEErXcy4vUQIJRw
// // 3eiDBGM7AgMBAAECggEAGiGYpxwcBoMwvxwDvr3ZJK+KqFnCvi8y2zZjsJ/66zSf
// // qHybSL9TUTLWnKrYtAK/J79duUOB1wl7YCRuI7OEu70pCvYeou3POqOx9PQJ0XVt
// // Ftp42h//QbJht8MfsbAkAxvypYGfLW6yLq3mH4B8BHtLL0zM1BdWuU/fkCLVGCh7
// // WH8DYaRTsSU3jmaGTYpR1QIvqtXc4lPa8kHoBZjile/FNXjWY4mEXAPOBkFzysAp
// // FsoZ7KKnxDtMNEhPOuMAiyGzQz6ukj9RfGI7NfyAqnIrvPp4aY64Ad7Jp0Ihd3mZ
// // 9v0Rxg86K5m3jOlVC/6ZENe4ac+P9o+ijE5jmC13gQKBgQDjkwHtkq7g7rHyur61
// // iatRr9aBIohDyHzbEEtPZf3OrLtiexc7svePj5ZHqlWoxKoE+NmhAC5BHVMfq3D6
// // HiItmby2Tqt1uglqvmRkSfm2LGSFxU15qlcIqRdVbkKY96jW+BdYJXeEIW57rN9k
// // 8P96ryb/tEmOlWvqC0RlVpyeMQKBgQC4mVZJv0JpRorQ05r5NVzi67thlFF6S3Iu
// // DacxQH4eh2kNft70fG9kH4h+yX7A71JbEh3pY/ioR0InfZJ3yPTUYZp5MJOwIOlW
// // MZzZsiQ/H9noFEmMm6RNH8yp+O3i4TaxAY/4lSUGqxTgXHT5+NA4zQS4BWtWbvDi
// // n0W3/4mhKwKBgQCFZPNZXYSyhle6TupgoOzR+f8DPMmg6dD922Q5izAlyCwigsJQ
// // lQv1k5XkNhz1yylZtsBiVifGtTi3NJgJlEY2cooiVqS8YisI7ccM3ivIM+dMXiWW
// // rllL00nBIttYrLrEHzIX0gZnZe1MAz4C/hzSvf5fHj+Lm1xhGO+jcwxk0QKBgQCx
// // 9QiNQbc5HAs4s7YDpuDr1Ysnz78YYWEqankSbvTmY23v164CDW+pGwkQCRmLz2sa
// // ZoW1eG2/dCqfPVwU5AK6N3meeSj3M1Meh+eIqkZtIDyGkgAxb93dh9laxqI2BR0f
// // WL09TDKMkiMnA5q1XJsHFwYEjRzkD0Fjh13DurIoTwKBgQCNCJ7vqrUwhUC5rz+N
// // V/NXMsod143D/4B2SOX078uFGBb1Rh/7ivU+A4C7aMYqnhY/DI1v7HEGlerUi3QI
// // cofkBc6ZPJNYrfF9hPQfi30viZcN3Wu4i2gi9Ava+4znSnI+yw+BTXrKFi88AhSm
// // Yn4DAVftb2apRprPIPftoGT9Mg==
// // -----END PRIVATE KEY-----
// // ` }),
// //     passwords: ['sample']
// //   })
// //   console.log(encrypted);

// //   const encryptedMessage = await openpgp.readMessage({
// //     armoredMessage: encrypted
// //   });

// //   const { data } = await openpgp.decrypt({
// //     message: encryptedMessage,
// //     passwords: ['sample']
// //   })

// //   console.log(data)

// // }

