import { Request, Response, Router } from "express";
import axios from "axios";
import { acceptAsset, byLogStatus, byStatus, cancelTransaction, createAsset, generatePdf, generatePdfTransaction, getAssets, getBackAssets, getLogs, getOrgDetails, notify, ownAsset, pullAssets, pushAssets, readAsset, readCollection, rejectTransaction, removeAsset, returnTransaction, transferAsset, transferNow, updateAsset } from "../helpers";
import models from "../models";
import { DateTime } from "luxon";
import { sleep } from "../utils/general";

const router = Router();

export const setupCollectionConfig = async (body: any) => {

    let { hosts, msps } = body;

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
    req.setTimeout(10000);
    let { action, args } = req.body;
    let data;
    try {

        const organization = await models.OrganizationDetails.findById(req.orgId, { organization_ip: 1, organization_port: 1, organization_name: 1 });
        const pair = await models.OrganizationChannelConnection.findOne({ channelId: args.channelId })

        if (!organization) return res.send({ message: "Error", details: "Cannot find your identity" });

        const node = axios.create({ baseURL: `https://${organization?.organization_ip}:${organization?.organization_port}` });

        const processNotification = async (data: any, title: string, after: string) => {
            let value = undefined;
            try {
                value = JSON.parse(data);
            } catch (error: any) {
                value = data
            }
            let id = pair?.organizationIds.filter(organiz => organiz.toString() !== req.orgId).join("");
            let anotherId = pair?.organizationIds.filter(organiz => organiz.toString() === req.orgId).join("");
            let organizationVal = await getOrgDetails(anotherId as string)
            if (value.message === "Done") notify(req.io, "notif", { action: 'refetch' }, id as string, title, `${organizationVal.details.organization_name} ${after}`);
        }

        switch (action) {
            case "CREATE":
                args.orgName = organization?.organization_name;
                args.orgId = req.orgId;
                args.host = organization?.organization_ip
                data = await createAsset(args, node);
                break;
            case "ASSETS":
                args.orgName = organization?.organization_name;
                args.host = organization?.organization_ip
                data = await getAssets(args, node);
                break;
            case "PDF":
                args.orgName = organization?.organization_name;
                args.host = organization?.organization_ip
                let forRender = await getAssets(args, node);
                let condition = [];
                if (args.assetIds && args.assetIds.length) {
                    condition = forRender.details.filter((asset: any) => {
                        return args.assetIds.includes(asset.asset_uuid);
                    })
                } else condition = forRender.details;
                data = await generatePdf(req.orgId, args.channelId, condition);
                break;
            case "READ":
                args.orgName = organization?.organization_name;
                args.host = organization?.organization_ip
                data = await readAsset(args, node);
                break;
            case "PDF_TRANSACTIONS":
                args.orgName = organization?.organization_name;
                args.host = organization?.organization_ip
                data = await readCollection(args, node);
                if (data.message === "Done") {
                    let items = data.details;
                    let gathered = items.filter((item: any) => {
                        return (DateTime.fromSeconds(item.created).setZone("Asia/Manila").toFormat('yyyy-MM-dd') >= args.startDate && DateTime.fromSeconds(item.created).setZone("Asia/Manila").toFormat('yyyy-MM-dd') <= args.endDate)
                    })
                    if (args.statuses.length) data.details = byStatus(args.statuses, gathered);
                    else data.details = gathered
                }
                if (data.message === "Done") {
                    data = await generatePdfTransaction(args.channelId, data.details);
                }
                break;
            case "READ_COLLECTION":
                args.orgName = organization?.organization_name;
                args.host = organization?.organization_ip
                data = await readCollection(args, node);
                if (data.message === "Done") {
                    let items = data.details;
                    let gathered = items.filter((item: any) => {
                        return (DateTime.fromSeconds(item.created).setZone("Asia/Manila").toFormat('yyyy-MM-dd') >= args.startDate && DateTime.fromSeconds(item.created).setZone("Asia/Manila").toFormat('yyyy-MM-dd') <= args.endDate)
                    })
                    if (args.statuses.length) data.details = byStatus(args.statuses, gathered);
                    else data.details = gathered
                }
                break;
            case "TRANSFER":
                args.orgName = organization?.organization_name;
                args.newOwnerMSP = `${args.channelId.replaceAll(args.orgName.replaceAll(/[^a-zA-Z0-9]/g, "").toLowerCase(), '')}MSP`;
                args.fromId = req.orgId;
                args.toId = pair?.organizationIds.filter(organiz => organiz.toString() !== req.orgId).join("")
                args.host = organization?.organization_ip
                data = await transferAsset(args, node);
                await processNotification(data, "Asset/s confirmation", "has sent you the confirmation for assets");
                break;
            case "ACCEPT":
                args.orgName = organization?.organization_name;
                args.host = organization?.organization_ip
                data = await acceptAsset(args, node);
                await processNotification(data, "Asset/s accepted", "has accepted the assets");
                break;
            case "TRANSFER_NOW":
                args.orgName = organization?.organization_name;
                args.host = organization?.organization_ip
                data = await transferNow(args, node);
                await processNotification(data, "Asset/s received", "has sent you the assets");
                break;
            case "OWN_ASSET":
                args.orgName = organization?.organization_name;
                args.host = organization?.organization_ip
                data = await ownAsset(args, node);
                await processNotification(data, "Asset/s ownership changed", "has fully acquired the assets");
                break;
            case "LOGS":
                args.orgName = organization?.organization_name;
                args.host = organization?.organization_ip
                args.orgId = req.orgId
                data = await getLogs(args, node);
                if (data.message === "Done") {
                    let items = data.details.details.logs;
                    if (Array.isArray(items)) {
                        let gathered = items.filter((item: any) => {
                            return (DateTime.fromSeconds(item.timestamp).setZone("Asia/Manila").toFormat('yyyy-MM-dd') >= args.startDate && DateTime.fromSeconds(item.timestamp).setZone("Asia/Manila").toFormat('yyyy-MM-dd') <= args.endDate)
                        })
                        if (args.statuses.length) data.details.details.logs = byLogStatus(args.statuses, items);
                        else data.details.details.logs = gathered
                    }
                }
                break;
            case "RETURN":
                args.orgName = organization?.organization_name;
                args.host = organization?.organization_ip
                args.orgId = req.orgId
                data = await returnTransaction(args, node);
                await processNotification(data, "Transaction returned", "has returned the transaction");
                break;
            case "PULL":
                args.orgName = organization?.organization_name;
                args.host = organization?.organization_ip
                args.orgId = req.orgId
                data = await getBackAssets(args, node);
                await processNotification(data, "Transaction pulled", "has pulled the assets from the transaction");
                break;
            case "MOVE":
                args.orgName = organization?.organization_name;
                args.host = organization?.organization_ip
                args.orgId = req.orgId
                data = await pullAssets(args, node);
                if (data.message === "Done") {
                    let asset = JSON.parse(data.details);
                    if (asset.message === "Done") {
                        args.assets = asset.details;
                        args.channelId = args.channelTo
                        data = await pushAssets(args, node);
                    } else {
                        throw new Error(asset.details);
                    }
                } else {
                    throw new Error(data.details);
                }
                break;
            case 'COPY':
                args.orgName = organization?.organization_name;
                args.host = organization?.organization_ip
                data = [];
                for (let assetId of args.assetIds) {
                    args.assetId = assetId;
                    let val = await readAsset(args, node);
                    if (val.message === "Done") {
                        let resp = val.details;
                        if (resp.message === "Done") {
                            data.push(resp.details);
                        } else throw new Error(resp.details)
                    } else throw new Error(val.details);
                }
                args.assets = data;
                args.channelId = args.channelTo
                data = await pushAssets(args, node);

                break
            case "PUSH":
                args.orgName = organization?.organization_name;
                args.host = organization?.organization_ip
                args.orgId = req.orgId
                data = await pushAssets(args, node);
                break;
            case "REJECT":
                args.orgName = organization?.organization_name;
                args.host = organization?.organization_ip
                args.orgId = req.orgId
                data = await rejectTransaction(args, node);
                await processNotification(data, "Transaction rejected", "has rejected the transaction");
                break;
            case "CANCEL":
                args.orgName = organization?.organization_name;
                args.host = organization?.organization_ip
                args.orgId = req.orgId
                data = await cancelTransaction(args, node);

                if (data.message === "Done") {
                    let _re = JSON.parse(data.details);
                    if (_re.message === "Done") {
                        await processNotification(data, "Transaction cancelled", "cancelled the transaction");
                    }
                }

                break;
            case "ACCEPT_RETURN":
                args.orgName = organization?.organization_name;
                args.host = organization?.organization_ip
                args.orgId = req.orgId
                data = await returnTransaction(args, node);
                break;
            case "UPDATE_ASSET":
                args.orgName = organization?.organization_name;
                args.host = organization?.organization_ip
                args.orgId = req.orgId
                data = await updateAsset(args, node);
                break;
            case "REMOVE_ASSET":
                args.orgName = organization?.organization_name;
                args.host = organization?.organization_ip
                args.orgId = req.orgId
                data = await removeAsset(args, node);
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

export const getAssetHistory = async (req: any, res: any) => {
    try {

        const { orgId, channelId, assetId } = req.body;
        let args = {
            channelId,
            assetId,
            orgName: "",
            host: ""
        }

        const organization = await models.OrganizationDetails.findById(orgId, { organization_ip: 1, organization_port: 1, organization_name: 1 });

        const node = axios.create({ baseURL: `https://${organization?.organization_ip}:${organization?.organization_port}` });

        args.orgName = organization?.organization_name as string;
        args.host = organization?.organization_ip as string

        let data = (await readAsset(args, node)) as any;

        const getOrgs = async (ids: string[]) => {
            const organization = await models.OrganizationDetails.find({ _id: { $in: ids } }, { organization_privkey: 0, organization_pubkey: 0 }).populate("organization_type_id").exec();
            return organization;
        }

        if (data.message === "Done") {
            let history: any = []

            let ids = data.details.details.history.map((item: any) => item.org)

            let orgs = await getOrgs(ids);

            data.details.details.history.map((item: any) => {
                orgs.map(org => {
                    if (item.org === org._id.toString()) history.push({ ...org.toJSON(), timestamp: item.timestamp });
                })
            })

            if (data.details.details.subAssets.length) {
                let id = await getOrgs([data.details.details.subAssets[0].history[1].org]);
                id.map(orgm => {
                    if (data.details.details.subAssets[0].history[1].org === orgm._id.toString()) history.push({ ...orgm.toJSON(), timestamp: data.details.details.subAssets[0].history[1].timestamp })
                })
            }

            res.send({ message: "Done", details: { ...data.details.details, history } })

        } else {
            res.send({ message: "Done", details: 'Cannot Find' })
        }


    } catch (error: any) {
        res.send({ message: "Error", details: error.message })
    }
}