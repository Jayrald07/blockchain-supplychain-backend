import * as grpc from '@grpc/grpc-js';
import { Contract, Gateway } from '@hyperledger/fabric-gateway';
import * as path from 'path';
import { v4 } from "uuid";
import { connectGrpc, getAllAssets, getAssetProvenance, newGrpcConnection, newIdentity, newSigner, readAssetByID, transferAssetAsync } from "../utils";

const cryptoPath = path.resolve('..', 'organizations', 'peerOrganizations', 'org2.example.com');

export async function blockchainInit(channel: string = "mychannel"): Promise<[Gateway | undefined, grpc.Client | undefined, Contract | undefined] | undefined> {
    // TLS Connection
    let client = await newGrpcConnection(path.resolve(cryptoPath, 'peers', 'peer0.org2.example.com', 'tls', 'ca.crt'), "localhost:9051", "peer0.org2.example.com");

    // User Identity
    let identity = await newIdentity(path.resolve(cryptoPath, 'users', 'User1@org2.example.com', 'msp', 'signcerts', 'cert.pem'), "Org2MSP");

    // Private Key
    let signer = await newSigner(path.resolve(cryptoPath, 'users', 'User1@org2.example.com', 'msp', 'keystore'))

    let gateway = connectGrpc(client, identity, signer);
    const network = gateway.getNetwork(channel);
    const contract = network.getContract(channel);

    console.log("Connected!")

    return [gateway, client, contract];



}