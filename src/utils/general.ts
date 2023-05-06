import openpgp, { createMessage, decrypt, encrypt, generateKey, readMessage, readPrivateKey } from "openpgp";

export const sleep = (seconds: number): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => resolve(true), seconds * 1000);
    })
}

const toDate = (data: string) => new Date(parseInt(data) * 1000)
export const toAssetJSON = (data: Array<any>): any => {
    console.log(data);
    if (Array.isArray(data)) {
        data.map(asset => {
            if (asset.timestamp && asset.data) {
                asset.timestamp.seconds = toDate(asset.timestamp.seconds)
                asset.data = JSON.parse(asset.data)
            }
        })
    }
    return data;
}

export const createKeys = async (name: string, email: string) => {

    const { privateKey, publicKey } = await generateKey({
        type: 'rsa',
        rsaBits: 4096,
        userIDs: [{ name, email }]
    })

    return { privateKey, publicKey }
}

export const decryptAsymData = async (enc: string, privateKey: any) => {
    console.log("decryptAsym", enc);

    const pvkey = await readPrivateKey({ armoredKey: privateKey })

    const message = await readMessage({
        armoredMessage: enc
    });

    const decrypted: any = await decrypt({
        message,
        decryptionKeys: pvkey
    });

    const chunks = [];
    for await (const chunk of decrypted.data) {
        chunks.push(chunk);
    }

    const decryptedData = chunks.join('');
    console.log({ decryptedData })
    return decryptedData
}

export const encryptSymData = async (value: string) => {

    const encrypted = await encrypt({
        message: await createMessage({ text: value }),
        passwords: [process.env.PGP_SYM_KEY as string]
    })

    return encrypted
}

export const decryptSymData = async (encrypted: string) => {
    console.log("decryptSym", encrypted);
    const encryptedMessage = await readMessage({
        armoredMessage: encrypted
    });

    const { data } = await decrypt({
        message: encryptedMessage,
        passwords: [process.env.PGP_SYM_KEY as string]
    })

    return data.toString();
}

