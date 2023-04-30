import { Request, Response } from "express";
import models from "../models";
import axios from "axios";
import { joinOrder, joinOrg, setupChaincode } from "../helpers";
import { Socket } from "socket.io-client";
import { Server } from "socket.io";

export const invitesReceived = async (req: any, res: Response) => {
    const invites = await models.Invite.find({
        invited_organization_id: req.orgId,
        status: { $in: ["INVITED", "ACCEPTED"] }
    }).populate("organization_id", "organization_name organization_type_id").exec();

    res.send({ message: "Done", details: invites })
}

export const invitesSent = async (req: any, res: Response) => {
    const invites = await models.Invite.find({
        organization_id: req.orgId,
        status: { $in: ["INVITED", "ACCEPTED"] }
    }).populate("invited_organization_id", "organization_name organization_type_id").exec();

    res.send({ message: "Done", details: invites })
}

export const inviteResponse = async (req: any, res: Response) => {
    const { status, inviteId } = req.body;

    console.log(status, inviteId)

    const invites = await models.Invite.findOneAndUpdate({ _id: inviteId }, { status }).exec();

    res.send({ message: "Done", details: invites })
}

export const inviteConnect = async (req: any, res: Response) => {
    const { inviteId } = req.body;
    const io: Server = req.io;

    try {

        res.send({ message: "Done", details: "In-Progress" })

        const invite = await models.Invite.findById(inviteId).populate("organization_id").populate("invited_organization_id").exec();

        console.log(invite)

        if (!invite) return res.send({ message: "Error", details: "Cannot find invite" });

        const orgName = (invite.organization_id as any)?.organization_name;
        const host = (invite.organization_id as any)?.organization_ip;
        const port = (invite.organization_id as any)?.organization_port;
        const channelToMSP = (invite.invited_organization_id as any)?.organization_name;
        const channelId = `${orgName}${channelToMSP}`;

        io.in(req.orgId).emit("p2p", {
            message: `Creating channel ${channelId}`,
            state: 0
        });
        const channel = await axios.post(`http://${host}:${port}/channel`, {
            channelId,
            orgName,
            channelToMSP
        })

        io.in(req.orgId).emit("p2p", {
            message: `Channel ${channelId} created`,
            state: 1
        });
        if (channel.data.message !== "Done") throw new Error(channel.data.details);

        const orderer = await joinOrder({ channelId, orgName, otherOrgName: channelToMSP, creatorHost: `${host}:${port}`, receiverHost: `${(invite.invited_organization_id as any).organization_ip}:${(invite.invited_organization_id as any).organization_port}`, orgType: "ORDERER", io, orgId: req.orgId });

        console.log({ orderer })

        const peer = await joinOrg({ channelId, orgName, otherOrgName: channelToMSP, creatorHost: `${host}:${port}`, receiverHost: `${(invite.invited_organization_id as any).organization_ip}:${(invite.invited_organization_id as any).organization_port}`, orgType: "PEER", io, orgId: req.orgId });

        console.log({ peer });

        const invites = await models.Invite.findOneAndUpdate({ _id: inviteId }, {
            $set: {
                status: "CONNECTED",
                dateConnected: new Date()
            }
        }).exec();

        if (!invites) throw new Error("Cannot find invite");

        const chaincode = await setupChaincode({
            channelId,
            primary: { host, port, orgName },
            secondary: {
                host: (invite.invited_organization_id as any).organization_ip,
                port: (invite.invited_organization_id as any).organization_port,
                orgName: channelToMSP,
                peerPort: peer.joined.details.port
            },
            io,
            orgId: req.orgId
        });

        console.log({ chaincode })

    } catch (error: any) {
        res.send({ message: "Error", details: error.message })
    }

}

export const connectedOrganizations = async (req: any, res: Response) => {
    console.log(req.orgId)
    let invites1 = await models.Invite.find({
        invited_organization_id: req.orgId,
        status: "CONNECTED"
    }).populate("organization_id", "organization_name organization_type_id").exec();

    let invites2 = await models.Invite.find({
        organization_id: req.orgId,
        status: "CONNECTED"
    }).populate("invited_organization_id", "organization_name organization_type_id").exec();

    return res.send({ message: "Done", details: [...invites1, ...invites2] });

}