import axios, { Axios, AxiosInstance } from "axios";
import { approveChaincode, checkCommitReadiness, collectAndTransferCa, commitChaincode, initializeChaincode, installChaincode, setupCollectionConfig } from "../controllers/chaincode";
import { v4 } from "uuid";
import models from "../models";
import { readFileSync } from "fs";
import { publicDecrypt } from "crypto";
import { decryptAsymData, decryptSymData } from "../utils/general";
import { Socket } from "socket.io";
import formData from "form-data";
import Mailgun from "mailgun.js";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import puppeteer from "puppeteer"

dotenv.config();

const mailgun = new Mailgun(formData);
const mg = mailgun.client({ username: 'api', key: process.env.MAILGUN_API_KEY as string })

const sleep = (ms: number) => {
    return new Promise((resolve, _) => {
        setTimeout(() => {
            resolve(true)
        }, ms)
    });
}

export const joinOrder = async (body: any) => {
    const { orgName, otherOrgName, channelId, creatorHost, receiverHost, orgType, io, orgId, host, pkey, pvkey } = body;
    try {
        io.in(orgId).emit("p2p", {
            message: `Getting channel "${channelId}" configuration`,
            state: 0
        });

        const { data } = await axios.post(`https://${creatorHost}/getChannelConfig`, {
            orgName,
            channelId,
            host: creatorHost.split(":")[0]
        })
        io.in(orgId).emit("p2p", {
            message: `Channel "${channelId}" configuration received`,
            state: 1
        });

        io.in(orgId).emit("p2p", {
            message: `Load channel "${channelId}" configuration`,
            state: 0
        });
        console.log({ data })

        const { data: result } = await axios.post(`https://${receiverHost}/receiveChannelConfig`, {
            channelConfig: data.details.config.data,
            ordererTlsCa: data.details.ordererTlsCa.data,
            orgName: otherOrgName,
            otherOrgName: orgName,
            channelId,
            orgType,
            host: receiverHost.split(":")[0]
        })
        io.in(orgId).emit("p2p", {
            message: `Channel "${channelId}" configuration loaded`,
            state: 1
        });

        io.in(orgId).emit("p2p", {
            message: `Sign channel "${channelId}" configuration updates`,
            state: 0
        });
        const { data: signed } = await axios.post(`https://${creatorHost}/signAndUpdateChannel`, {
            orgName,
            channelId,
            updateBlock: result.details.block.data,
            orgType,
            host: creatorHost.split(":")[0]
        })
        io.in(orgId).emit("p2p", {
            message: `Channel "${channelId}" configuration has been signed and updated`,
            state: 1
        });

        io.in(orgId).emit("p2p", {
            message: `Getting channel "${channelId}" updated configuration`,
            state: 0
        });
        const { data: config } = await axios.post(`https://${creatorHost}/getChannelConfig`, {
            orgName,
            channelId,
            host: creatorHost.split(":")[0]
        })
        io.in(orgId).emit("p2p", {
            message: `Update channel "${channelId}" configuration received`,
            state: 1
        });

        io.in(orgId).emit("p2p", {
            message: `Joining your orderer in consensus channel "${channelId}"`,
            state: 0
        });
        const { data: joined } = await axios.post(`https://${receiverHost}/joinOrdererNow`, {
            channelId,
            orgName: otherOrgName,
            channelConfig: data.details.config.data,
            host: receiverHost.split(":")[0]
        })
        io.in(orgId).emit("p2p", {
            message: `Orderer has joined channel "${channelId}"`,
            state: 1
        });

        return { joined };
    } catch (err: any) {
        return err.message;
    }
}

export const joinOrg = async (body: any): Promise<any> => {
    const { orgName, otherOrgName, channelId, creatorHost, receiverHost, orgType, io, orgId, host, pkey, pvkey } = body;

    try {

        io.in(orgId).emit("p2p", {
            message: `Getting channel "${channelId}" configuration`,
            state: 0
        });
        const { data } = await axios.post(`https://${creatorHost}/getChannelConfig`, {
            orgName,
            channelId,
            host: creatorHost.split(":")[0]
        })
        console.log({ message: "Get", data })
        io.in(orgId).emit("p2p", {
            message: `Channel "${channelId}" configuration received`,
            state: 1
        });

        io.in(orgId).emit("p2p", {
            message: `Load channel "${channelId}" configuration`,
            state: 0
        });
        const { data: result } = await axios.post(`https://${receiverHost}/receiveChannelConfig`, {
            channelConfig: data.details.config.data,
            ordererTlsCa: data.details.ordererTlsCa.data,
            orgName: otherOrgName,
            otherOrgName: orgName,
            channelId,
            orgType,
            host: receiverHost.split(":")[0]
        })
        console.log({ message: "channel", result })
        io.in(orgId).emit("p2p", {
            message: `Channel "${channelId}" configuration loaded`,
            state: 1
        });

        io.in(orgId).emit("p2p", {
            message: `Sign channel "${channelId}" configuration updates`,
            state: 0
        });
        const { data: signed } = await axios.post(`https://${creatorHost}/signAndUpdateChannel`, {
            orgName,
            channelId,
            updateBlock: result.details.block.data,
            orgType,
            host: creatorHost.split(":")[0]
        })
        console.log({ message: "sign channel", signed })

        io.in(orgId).emit("p2p", {
            message: `Channel "${channelId}" configuration has been signed and updated`,
            state: 1
        });

        io.in(orgId).emit("p2p", {
            message: `Joining your peer in channel "${channelId}"`,
            state: 0
        });
        const { data: joined } = await axios.post(`https://${receiverHost}/joinChannelNow`, {
            channelId,
            ordererGeneralPort: signed.details.ordererGeneralPort,
            otherOrgName: orgName,
            orgName: otherOrgName,
            updateBlock: signed.details.block.data,
            ordererTlsCa: data.details.ordererTlsCa.data,
            host: receiverHost.split(":")[0],
            otherHost: creatorHost.split(":")[0]
        })
        console.log({ message: "join peer", joined })

        io.in(orgId).emit("p2p", {
            message: `Peer has joined channel "${channelId}"`,
            state: 1
        });

        return { joined };
    } catch (err: any) {
        return err.message;
    }

}

export const setupChaincode = async (body: any) => {
    const {
        channelId,
        primary,
        secondary,
        io,
        orgId
    } = body;

    try {

        io.in(orgId).emit("p2p", {
            message: `Setting up private state`,
            state: 0
        });

        const setupConfig = await setupCollectionConfig({
            msps: [`${primary.orgName}MSP`, `${secondary.orgName}MSP`],
            hosts: [
                {
                    host: primary.host,
                    port: primary.port
                },
                {
                    host: secondary.host,
                    port: secondary.port
                }
            ]
        })
        io.in(orgId).emit("p2p", {
            message: `Private state has been setup`,
            state: 1
        });

        await sleep(5000);

        io.in(orgId).emit("p2p", {
            message: `Installing the chaincode`,
            state: 0
        });
        const installChain = await installChaincode({
            hosts: [
                {
                    host: primary.host,
                    port: primary.port,
                    hostname: primary.orgName,
                    channel: channelId
                },
                {
                    host: secondary.host,
                    port: secondary.port,
                    hostname: secondary.orgName,
                    channel: channelId
                }
            ]
        })
        io.in(orgId).emit("p2p", {
            message: `Chaincode installed`,
            state: 1
        });

        await sleep(5000);

        io.in(orgId).emit("p2p", {
            message: `Approving the chaincode`,
            state: 0
        });
        const approveChain = await approveChaincode({
            hosts: [
                {
                    host: primary.host,
                    port: primary.port,
                    hostname: primary.orgName,
                    channel: channelId
                },
                {
                    host: secondary.host,
                    port: secondary.port,
                    hostname: secondary.orgName,
                    channel: channelId
                }
            ]
        })
        io.in(orgId).emit("p2p", {
            message: `Chaincode approved`,
            state: 1
        });

        await sleep(5000);

        io.in(orgId).emit("p2p", {
            message: `Setting up and loading required certificate`,
            state: 0
        });
        const collectAndTransfer = await collectAndTransferCa({
            host: primary.host,
            port: primary.port,
            hostname: primary.orgName,
            hosts: [
                {
                    host: secondary.host,
                    port: secondary.port,
                    hostname: secondary.orgName
                }
            ]
        })
        io.in(orgId).emit("p2p", {
            message: `Certificate has been setup`,
            state: 1
        });

        await sleep(5000);

        io.in(orgId).emit("p2p", {
            message: `Check readiness`,
            state: 0
        });
        const checkReadiness = await checkCommitReadiness({
            host: primary.host,
            port: primary.port,
            hostname: primary.orgName,
            channel: channelId
        })
        io.in(orgId).emit("p2p", {
            message: `Readiness approved`,
            state: 1
        });

        await sleep(5000);

        io.in(orgId).emit("p2p", {
            message: `Committing the chaincode`,
            state: 0
        });
        const commit = await commitChaincode({
            host: primary.host,
            port: primary.port,
            hostname: primary.orgName,
            channel: channelId,
            externals: [
                {
                    host: secondary.host,
                    port: secondary.peerPort,
                }
            ]
        })
        io.in(orgId).emit("p2p", {
            message: `Chaincode committed`,
            state: 1
        });

        await sleep(5000);

        io.in(orgId).emit("p2p", {
            message: `Initializing the chaincode`,
            state: 0
        });
        const initialize = await initializeChaincode({
            host: primary.host,
            port: primary.port,
            hostname: primary.orgName,
            channel: channelId,
            externals: [
                {
                    host: secondary.host,
                    port: secondary.peerPort,
                }
            ]
        })
        io.in(orgId).emit("p2p", {
            message: `Chaincode initialized`,
            state: 2
        });

        await sleep(5000);

        return { message: "Done", details: initialize };


    } catch (err: any) {
        return { message: "Error", details: err.message }
    }

}

export const createAsset = async (body: any, node: AxiosInstance) => {

    const { asset_name, orgId, channelId } = body;

    try {
        const asset = new models.Asset({ asset_name, asset_uuid: v4().replaceAll("-", ""), origin: orgId })
        const response = await asset.save();

        await models.OrganizationAsset.findOne({ organization_details_id: { $eq: orgId as string } })

        body.assetId = response.asset_uuid
        body.channelId = channelId
        console.log({ body })
        const { data } = await node.post("/createAsset", body)
        console.log(data);
        return { message: "Done", details: JSON.parse(data) }
    } catch (e: any) {
        return { message: "Error", details: e.message };
    }

}

export const getAssets = async (body: any, node: AxiosInstance) => {

    try {
        const { data } = await node.post("/getAssets", body)

        const assets = await models.Asset.find({ isDelete: 0, asset_uuid: { $in: data.details } }, { isDelete: 0, __v: 0 }).populate("origin", { organization_name: 1, _id: 0 })

        return { message: "Done", details: assets }
    } catch (err: any) {
        console.log("read")
        return { message: "Error", details: err.message };
    }

}


export const readAsset = async (body: any, node: AxiosInstance) => {

    try {
        const { data } = await node.post("/readAsset", body)

        if (data.message === "Done") {
            const asset = await models.Asset.find({ asset_uuid: data.details.assetId });

            if (asset) {
                data.details.asset_name = asset[0].asset_name;
            }

            return { message: "Done", details: data }
        }

    } catch (err: any) {
        console.log("read")
        return { message: "Error", details: err.message };
    }

}

export const readCollection = async (body: any, node: AxiosInstance) => {

    try {
        const { data } = await node.post("/readAssetCollection", body)

        return { message: "Done", details: data }
    } catch (err: any) {
        return { message: "Error", details: err.message };
    }

}

export const transferAsset = async (body: any, node: AxiosInstance) => {
    try {
        body.transactionId = v4().replaceAll("-", "");
        const { data } = await node.post("/transferAsset", body)

        return { message: "Done", details: JSON.parse(data).details }
    } catch (err: any) {
        return { message: "Error", details: err.message };
    }
}

export const acceptAsset = async (body: any, node: AxiosInstance) => {
    try {
        const { data } = await node.post("/acceptAsset", body)

        return { message: "Done", details: data }
    } catch (err: any) {
        return { message: "Error", details: err.message };
    }
}

export const transferNow = async (body: any, node: AxiosInstance) => {
    try {
        const { data } = await node.post("/transferNow", body)

        return { message: "Done", details: data }
    } catch (err: any) {
        return { message: "Error", details: err.message };
    }
}

export const ownAsset = async (body: any, node: AxiosInstance) => {
    try {
        console.log(body);
        const { data } = await node.post("/ownAsset", body)

        return { message: "Done", details: data }
    } catch (err: any) {
        return { message: "Error", details: err.message };
    }
}

export const getLogs = async (body: any, node: AxiosInstance) => {
    try {
        let { data } = await node.post("/logs", body)

        const org = await models.OrganizationDetails.findById(body.orgId);

        if (org) {

            data = data.details.filter((detail: any) => detail.initiated === `${org.organization_name}MSP`);

            return { message: "Done", details: data }

        } else return { message: 'Error', details: 'Organization not found.' }

    } catch (err: any) {
        return { message: "Error", details: err.message };
    }
}

export const notify = async (io: Socket, event: string, data: any, organizationId: string, title: string, description: string) => {
    try {

        const notif = new models.Notification({
            organization_id: organizationId,
            title,
            description
        });

        const notifSave = await notif.save();

        if (!notifSave) return { message: "Error", details: 'Error Saving' };

        io.in(organizationId).emit(event, data);
        io.in(organizationId).emit('notif', { action: 'refetch' })

        return { message: "Done", details: "Organization notified" }

    } catch (error: any) {

        return { message: "Error", details: error.message }

    }
}

export const sendMail = async (email: string, template: string, variables: any) => {
    try {
        const msg = await mg.messages.create('chainblockdirect.live', {
            from: 'ChainDirect <no-reply@chainblockdirect.live>',
            to: [email],
            subject: 'Email Verification',
            template: template,
            't:variables': JSON.stringify(variables)
        })
        return { message: "Done", details: msg };
    } catch (error: any) {
        return { message: "Error", details: error.message }
    }
}

export const validateJwt = async (token: string) => {
    try {

        let details = jwt.verify(token, process.env.SECRET_KEY as string);

        return { message: 'Done', details: 'Valid' }

    } catch (error: any) {

        return { message: 'Error', details: error.message };

    }
}

export const generatePdf = async (html: string) => {
    try {

        const browser = await puppeteer.launch({
            headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        await page.setContent(html);
        const pdf = await page.pdf({ format: 'A4' });

        await browser.close();

        return { message: "Done", details: pdf.toString("base64") };

    } catch (error: any) {

        return { message: "Error", details: error.message }

    }
}