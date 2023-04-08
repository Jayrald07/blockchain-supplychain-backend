import fss, { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import * as grpc from '@grpc/grpc-js';
import { TextDecoder } from "util";
import { Identity, Signer, signers, connect, Gateway, Contract, SubmittedTransaction, Network } from "@hyperledger/fabric-gateway";
import { toAssetJSON } from "./general";

interface Asset {
    color: string
    id: string
    owner: string
    size: string
    // doctype: string
}

enum Response {
    OK = 1,
    ERROR
}

const utf8Decoder = new TextDecoder();

export async function newGrpcConnection(tlsCertPath: fss.PathLike, peerEndpoint: string, peerHostAlias: string): Promise<grpc.Client> {
    const tlsRootCert: Buffer = await fs.readFile(tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    return new grpc.Client(peerEndpoint, tlsCredentials, {
        'grpc.ssl_target_name_override': peerHostAlias,
    });
}

export async function newIdentity(certPath: string, mspId: string): Promise<Identity> {
    const credentials = await fs.readFile(certPath);
    return { mspId, credentials };
}

export async function newSigner(keyDirectoryPath: string): Promise<Signer> {
    const files = await fs.readdir(keyDirectoryPath);
    const keyPath = path.resolve(keyDirectoryPath, files[0]);
    const privateKeyPem = await fs.readFile(keyPath);
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    return signers.newPrivateKeySigner(privateKey);
}

export function connectGrpc(client: grpc.Client, identity: Identity, signer: Signer): Gateway {
    return connect({
        client,
        identity,
        signer,
        evaluateOptions: () => {
            return { deadline: Date.now() + 5000 };
        },
        endorseOptions: () => {
            return { deadline: Date.now() + 15000 };
        },
        submitOptions: () => {
            return { deadline: Date.now() + 5000 };
        },
        commitStatusOptions: () => {
            return { deadline: Date.now() + 60000 };
        },
    })
}

export async function createAsset(contract: Contract, data: Asset | { id: string, color: string, size: string, owner: string }): Promise<Asset | { id: string, color: string, size: string, owner: string }> {
    const { id, color, size, owner } = data;

    // await contract.submitTransaction(
    //     'CreateAsset',
    //     id,
    //     color,
    //     size,
    //     owner,
    // );

    await contract.submit("CreatePrivateData", {
        transientData: { asset_properties: JSON.stringify({ color, owner, size, assetID: id }) }
    })

    return data
}

export async function readAssetByID(contract: Contract, ID: string): Promise<JSON> {
    const resultBytes = await contract.evaluateTransaction('ReadAssetPrivateDetails', ID);
    const resultJson = utf8Decoder.decode(resultBytes);
    console.log(JSON.parse(Buffer.from(JSON.parse(resultJson).data).toString()))
    // return toAssetJSON(JSON.parse(resultJson));
    return JSON.parse(Buffer.from(JSON.parse(resultJson).data).toString())
}

export async function updateAsset(contract: Contract, data: Asset): Promise<Asset> {
    const { color, size, id, owner } = data;
    await contract.submitTransaction(
        'UpdateAsset',
        id,
        color,
        size,
        owner
    );
    return data
}

export async function deleteAsset(contract: Contract, ID: string): Promise<Response> {
    await contract.submitTransaction("DeleteAsset", ID);
    return Response.OK
}

export async function transferAssetAsync(contract: Contract, ID: string, owner: string): Promise<Response> {

    const commit: SubmittedTransaction = await contract.submitAsync('TransferAsset', {
        arguments: [ID, owner],
    });

    // Pwedeng magamit later, kaya comment muna hehe
    // const oldOwner = utf8Decoder.decode(commit.getResult());

    const status = await commit.getStatus();
    if (!status.successful) {
        throw new Error(`Transaction ${status.transactionId} failed to commit with status code ${status.code}`);
    }

    return Response.OK
}

export async function getAssetProvenance(contract: Contract, ID: string): Promise<JSON> {
    const resultBytes = await contract.submitTransaction("GetAssetProvenance", ID);
    return toAssetJSON(JSON.parse(utf8Decoder.decode(resultBytes)));
}

export async function getAllAssets(contract: Contract): Promise<JSON> {
    const resultBytes = await contract.evaluateTransaction('GetAllAssets');
    const resultJson = utf8Decoder.decode(resultBytes);
    return toAssetJSON(JSON.parse(resultJson));
}


export async function closeGRPCConnection(gateway: Gateway, client: grpc.Client): Promise<Response> {
    gateway.close();
    client.close();
    return Response.OK
}

export function isPasswordValid(password: string) {
    const conditions: any = {
        characters: "Password should contain 8 or more than characters",
        capital: "Password should start with a capital letter",
        number: "Password should contain number",
        special: "Password should contain atleast 1 speacial characters"
    }

    if (/.{8}/.test(password)) delete conditions.characters;
    if (/\d/.test(password)) delete conditions.number;
    if (/^[A-Z]/.test(password)) delete conditions.capital;
    if (/[!@#$%^&*(),.?":{}|<>_]/.test(password)) delete conditions.special;

    return conditions;
}

export function promiseCallback(callback: Function): void {

}