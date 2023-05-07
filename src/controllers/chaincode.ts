import { Request, Response, Router } from "express";
import axios from "axios";
import { acceptAsset, createAsset, getAssets, getLogs, ownAsset, readAsset, readCollection, transferAsset, transferNow } from "../helpers";
import models from "../models";

const router = Router();

export const setupCollectionConfig = async (body: any) => {

    let { hosts, msps } = body;

    console.log(JSON.stringify({ body }))

    try {

        const all = await Promise.all(hosts.map((host: any) => {
            return axios.post(`https://${host.host}:${host.port}/setup-collections-config`, {
                msps
            });
        }));

        return { message: "Done", details: all.map(item => item.data) }

    } catch (error: any) {
        return { message: "Error", details: error.message };
    }

}

export const installChaincode = async (body: any) => {

    const { hosts } = body;
    console.log(JSON.stringify({ body }))

    try {
        const all = await Promise.all(hosts.map((host: any) => {
            return axios.post(`https://${host.host}:${host.port}/installchaincode`, {
                channel: host.channel,
                hostname: host.host,
                orgName: host.hostname
            });
        }));


        return { message: "Done", details: all.map(item => item.data) };
    } catch (err: any) {
        return { message: "Error", details: err.message };
    }

}

export const approveChaincode = async (body: any) => {

    const { hosts } = body;
    console.log(JSON.stringify({ body }))

    try {
        const all = await Promise.all(hosts.map((host: any) => {
            return axios.post(`https://${host.host}:${host.port}/approvechaincode`, {
                channel: host.channel,
                hostname: host.host,
                orgName: host.hostname
            });
        }));


        return { message: "Done", details: all.map(item => item.data) };
    } catch (err: any) {
        return { mssage: "Error", details: err.message };
    }

}

export const collectAndTransferCa = async (body: any) => {

    const { hosts, host, port } = body;
    console.log(JSON.stringify({ body }))

    try {

        const all = await Promise.all(hosts.map((host: any) => {
            return axios.post(`https://${host.host}:${host.port}/collectandtransferca`, {
                hostname: host.hostname
            });
        }));

        const cas = all.map(item => item.data);

        const saved = await axios.post(`https://${host}:${port}/savetemporaryca`, {
            cas: cas[0]
        });


        return { message: "Done", details: saved.data };

    } catch (err: any) {
        return { mssage: "Error", details: err.message };
    }

}


export const checkCommitReadiness = async (body: any) => {

    const { hostname, channel, host, port } = body;
    console.log(JSON.stringify({ body }))

    try {
        const chaincode = await axios.post(`https://${host}:${port}/checkcommitreadiness`, {
            channel,
            hostname: host,
            orgName: hostname
        });
        return { message: "Done", details: chaincode.data };

    } catch (err: any) {
        return { mssage: "Error", details: err.message };
    }

}

export const commitChaincode = async (body: any) => {

    const { hostname, channel, host, externals, port } = body;
    console.log(JSON.stringify({ body }))

    try {
        const chaincode = await axios.post(`https://${host}:${port}/commitchaincode`, {
            channel,
            hostname: host,
            orgName: hostname,
            externals
        });
        return { message: "Done", details: chaincode.data };
    } catch (err: any) {
        return { mssage: "Error", details: err.message };
    }

}

export const initializeChaincode = async (body: any) => {

    const { hostname, channel, port, host, externals } = body;
    console.log(JSON.stringify({ body }))

    try {
        const chaincode = await axios.post(`https://${host}:${port}/initializechaincode`, {
            channel,
            hostname: host,
            orgName: hostname,
            externals
        });

        return { message: "Done", details: chaincode.data };

    } catch (err: any) {
        return { message: "Error", details: err.message };
    }

}


export const performAction = async (req: any, res: Response) => {
    let { action, args } = req.body;
    let data;
    try {

        const organization = await models.OrganizationDetails.findById(req.orgId, { organization_ip: 1, organization_port: 1, organization_name: 1 });


        const node = axios.create({ baseURL: `https://${organization?.organization_ip}:${organization?.organization_port}` });

        switch (action) {
            case "CREATE":
                args.orgName = organization?.organization_name;
                args.orgId = req.orgId;
                args.host = organization?.organization_ip
                data = await createAsset(args, node);
                console.log({ data })
                break;
            case "ASSETS":
                args.orgName = organization?.organization_name;
                args.host = organization?.organization_ip
                data = await getAssets(args, node);
                console.log(data)
                break;
            case "READ":
                args.orgName = organization?.organization_name;
                args.host = organization?.organization_ip
                data = await readAsset(args, node);
                break;
            case "READ_COLLECTION":
                args.orgName = organization?.organization_name;
                args.host = organization?.organization_ip
                data = await readCollection(args, node);
                break;
            case "TRANSFER":
                args.orgName = organization?.organization_name;
                args.newOwnerMSP = `${args.channelId.replaceAll(args.orgName, '')}MSP`;
                args.host = organization?.organization_ip
                data = await transferAsset(args, node);
                break;
            case "ACCEPT":
                args.orgName = organization?.organization_name;
                args.host = organization?.organization_ip
                data = await acceptAsset(args, node);
                break;
            case "TRANSFER_NOW":
                args.orgName = organization?.organization_name;
                args.host = organization?.organization_ip
                data = await transferNow(args, node);
                break;
            case "OWN_ASSET":
                args.orgName = organization?.organization_name;
                args.host = organization?.organization_ip
                data = await ownAsset(args, node);
                break;
            case "LOGS":
                args.orgName = organization?.organization_name;
                args.host = organization?.organization_ip
                args.orgId = req.orgId
                data = await getLogs(args, node);
                break;

            default:
                data = "Please input valid chaincode action"
                break;
        }

        res.send({ message: "Done", details: data })
    } catch (err: any) {
        res.send({ message: "Error", details: err.message })
    }

}