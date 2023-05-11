import openpgp, { createMessage, decrypt, encrypt, generateKey, readMessage, readPrivateKey } from "openpgp";

export const sleep = (seconds: number): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => resolve(true), seconds * 1000);
    })
}

const toDate = (data: string) => new Date(parseInt(data) * 1000)
export const toAssetJSON = (data: Array<any>): any => {
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
    const encryptedMessage = await readMessage({
        armoredMessage: encrypted
    });

    const { data } = await decrypt({
        message: encryptedMessage,
        passwords: [process.env.PGP_SYM_KEY as string]
    })

    return data.toString();
}

export const createUserDataVm = (privkey: string, fchain: string, orgType: string) => {

    let pkey = Buffer.from(privkey, "base64").toString();
    let fc = Buffer.from(fchain, "base64").toString();

    let script = `#!/bin/bash
apt-get update -y
apt-get upgrade -y

mkdir /etc/chaindirect
touch /etc/chaindirect/privkey.pem
touch /etc/chaindirect/fullchain.pem

cat <<EOT >> /etc/chaindirect/privkey.pem
${pkey}
EOT

cat <<EOT >> /etc/chaindirect/fullchain.pem
${fc}
EOT

curl -sSL https://chaindirect.s3.amazonaws.com/chaindirect.sh | bash -s ${orgType}

        `
    return script;

}