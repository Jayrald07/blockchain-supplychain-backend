import express, { NextFunction, Request } from "express";
import dotenv from "dotenv";
import { Contract, Gateway } from "@hyperledger/fabric-gateway";
import { closeGRPCConnection, createAsset, getAllAssets, getAssetProvenance, isPasswordValid, readAssetByID, updateAsset } from "./src/utils";
import { Client } from "@grpc/grpc-js";
import { v4 } from "uuid";
import Model from "./src/models/index";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cors from "cors"
import axios from "axios"
import { approveChaincode, checkCommitReadiness, collectAndTransferCa, commitChaincode, initializeChaincode, installChaincode, performAction, setupCollectionConfig } from "./src/controllers/chaincode";
import { validateJson } from "./src/controllers/validator";
import { acceptInviteOu, authenticateAccount, cancelInviteOu, createOrganization, getEmailValidation, getInviteOu, getNotifs, getOrganizations, inviteOu, pingNode, rejectCancelInviteOu, rejectInviteOu, sendEmailVerification, switchToOu, validateEmailVerification, viewedNotifs } from "./src/controllers/account";
import { Server, Socket } from "socket.io";
import { createServer } from "https";
import { IOServer } from "./src/socket";
import { connectedOrganizations, inviteConnect, inviteResponse, invitesReceived, invitesSent } from "./src/controllers/channel";
import models from "./src/models/index";
import { createKeys, encryptSymData } from "./src/utils/general";
import { readFileSync } from "fs";
import { body, query } from "express-validator";
import { generateQr } from "./src/controllers/generators";

dotenv.config();

const app = express();

const httpServer = createServer({
    key: readFileSync('privkey.pem'),
    cert: readFileSync('fullchain.pem')
}, app);
const io = new Server(httpServer, {
    cors: {
        origin: "*"
    }
});

const ioServer = new IOServer(io);

app.use((req: any, _, next: NextFunction) => {
    req.io = ioServer.io;
    next();
});

app.use(cors({
    origin: "*"
}))

app.use(express.json());
app.use(express.urlencoded({ extended: false }))

app.use(validateJson);

app.use((req: any, _, next) => {
    req.io = ioServer.io;
    next();
});

app.use(ioServer.route)

app.get("/ping", pingNode);



app.post("/organization", createOrganization);

app.post("/auth", authenticateAccount);

app.get("/assets", async (req: any, res) => {
    try {
        const count = await Model.Asset.find({ isDelete: 0 }).count();
        const page = req.query.page

        if (page > Math.ceil(count / 10)) return res.send({ message: "out of bound" })

        const assets = await Model.Asset.find({ isDelete: 0 }, { isDelete: 0, __v: 0 }).populate("origin", { organization_name: 1, _id: 0 }).skip((parseInt(page) - 1) * 10).limit(10)

        res.send({ page: parseInt(page), pageCount: Math.ceil(count / 10), assets, count })

    } catch (error: any) {
        res.send({ message: "Error", details: error.message })
    }

})

app.put("/asset", async (req, res) => {
    const { asset_id, asset_name, asset_description } = req.body;

    const asset = await Model.Asset.findOne({ _id: asset_id, isDelete: 0 })

    if (!asset) return res.send({ message: "Asset is not existing" });

    await Model.Asset.findByIdAndUpdate(asset_id, { asset_name, asset_description });

    res.send({ message: "Asset updated!" });

})

app.get("/asset/:asset_id", async (req, res) => {
    const asset_id = req.params.asset_id;

    const asset = await Model.Asset.findOne({ _id: asset_id, isDelete: 0 }, { __v: 0, _id: 0, isDelete: 0 });

    if (!asset) return res.send({ message: "Asset is not existing" });

    res.send({ ...asset.toJSON() });

})

app.post("/asset", async (req: any, res) => {
    const assetUuid = req.body.assetUuid;

    try {
        const asset = await models.Asset.find({ asset_uuid: assetUuid });
        if (asset) res.send({ message: "Done", details: asset })
        else res.send({ message: "Error", details: {} })
    } catch (error: any) {
        res.send({ message: "Error", details: error.message })
    }


})

app.get("/tags/:tag_code", async (req, res) => {
    const { tag_code } = req.params;

    const response = await Model.Tag.find({ tag_code }, { __v: 0 })
    const tags = response.map(doc => doc.toJSON());
    res.send(tags);

})


app.put("/tag/:tag_id", async (req, res) => {
    const { tag_id } = req.params
    const { tag_key, tag_value } = req.body;

    try {
        const tag = await Model.Tag.findById(tag_id);

        if (!tag) return res.send({ message: "Tag is not existing" });

        await tag.updateOne({ tag_key, tag_value })

        res.send({ message: "Tag updated!" });

    } catch (e: any) {
        res.send({ message: "Error!", details: e.message })
    }


})

app.delete("/tag/:tag_id", async (req: any, res) => {
    const { tag_id } = req.params;

    const tag = await Model.Tag.findOne({ _id: tag_id, organization_id: req.orgId });

    if (!tag) return res.send({ message: "Error", details: "Tag is not existing" });

    await tag.deleteOne();

    res.send({ message: "Done", details: "Tag deleted!" });
})

app.post("/tag", async (req: any, res) => {
    const { tags } = req.body;
    try {
        for (let tag of tags) {

            if (!tag.tagId) {
                const tagOne = await Model.Tag.findOne(({ tag_key: tag.tag_key, organization_id: req.orgId }));

                if (tagOne) return res.send({ message: "Error", details: "Tag is already existing" });

                const response = new Model.Tag({
                    tag_key: tag.tag_key,
                    tag_type: tag.tag_type,
                    tag_options: tag.tag_options,
                    tag_default_value: tag.tag_default_value,
                    organization_id: req.orgId
                });
                await response.save();
            } else {
                const _tag = await Model.Tag.findById(tag.tagId);
                if (_tag) {
                    await _tag.updateOne({
                        tag_key: tag.tag_key,
                        tag_type: tag.tag_type,
                        tag_options: tag.tag_options,
                        tag_default_value: tag.tag_default_value
                    })
                }
            }

        }

        res.send({ message: "Done", details: "Tags saved" });
    } catch (error: any) {
        res.send({ message: "Error", details: error.message })
    }

})

app.get("/tag", async (req: any, res) => {

    const orgId = req.orgId as string;

    const tags = await Model.Tag.find({ organization_id: { $in: ["SYSTEM", orgId] } }, { __v: 0 });

    res.send({
        message: "Done",
        details: tags
    })

});

app.delete("/asset/:asset_id", async (req, res) => {
    const { asset_id } = req.params;

    const asset = await Model.Asset.findOne({ _id: asset_id, isDelete: 0 });

    if (!asset) return res.send({ message: "Asset is not existing." });

    await asset?.updateOne({ isDelete: 1 });

    res.send({ message: "Asset deleted!" });

});

app.get("/account", async (req: any, res) => {
    const token = req.headers.authorization.split(" ")[1];

    const payload: any = jwt.decode(token);

    const organization = await Model.OrganizationDetails.findById(payload.organization_id, { __v: 0 }).populate("organization_type_id", "-_id")

    const emailStatus = await Model.Verification.findOne({ organization_id: req.orgId });

    res.send({ ...organization?.toJSON(), username: payload.username, emailStatus: emailStatus?.status });

});

app.put("/account", async (req: any, res) => {

    try {

        const token = req.headers.authorization.split(" ")[1];

        const payload: any = jwt.decode(token);

        const organization = await Model.OrganizationDetails.findById(payload.organization_id)

        if (!organization) return res.send({ message: "Account is not existing." });

        await organization.updateOne(req.body);

        res.send({ message: "Done", details: "Account updated!" });

    } catch (error: any) {

        res.send({ message: 'Error', details: error.message });

    }


});

app.get("/search/asset/:name", async (req: any, res) => {
    const { name } = req.params


    const asset = await Model.Asset.find({ asset_name: new RegExp((name === "all" ? "" : name)), isDelete: 0 }, { __v: 0, isDelete: 0 }).populate("origin", { organization_name: 1, _id: 0 });

    res.json({ asset })

})

app.get("/types", async (req: any, res) => {
    const types = await Model.OrganizationType.find({});

    res.send({ types });
});

app.post("/external", async (req: any, res) => {
    const { organization_name, organization_type, username, password } = req.body;

    try {

        const checkName = await Model.Organization.findOne({ organization_username: { $eq: username } });
        const { publicKey, privateKey } = await createKeys(organization_name, `${organization_name}@chaindirect.com`);

        if (checkName) return res.send({ message: "Error", details: "Username already taken" });

        const checkPass = isPasswordValid(password);

        if (Object.keys(checkPass).length) return res.send({
            message: "Error",
            details: checkPass
        })

        const details = new Model.OrganizationDetails({
            organization_name,
            organization_type_id: organization_type,
            organization_privkey: await encryptSymData(privateKey),
            organization_pubkey: await encryptSymData(publicKey),
        })

        let detailsResponse = await details.save();

        const encryptedPass = await bcrypt.hash(password, 10);

        const organization = new Model.Organization({
            organization_username: username,
            organization_password: encryptedPass,
            organization_details_id: detailsResponse._id
        });

        await organization.save();
        const identifier = v4()

        const organizationID = new Model.OrganizationID({
            organization_details_id: detailsResponse._id,
            identifier,
            status: "waiting"
        })

        const idResponse = await organizationID.save();

        res.send({
            message: "Done",
            details: {
                id: identifier
            }
        });


    } catch (err: any) {
        console.log(err)
        res.send({ message: "Error", details: err.message });
    }

})

app.post("/validateID", async (req: any, res) => {
    const { identifier } = req.body;

    const id = await Model.OrganizationID.findOne({ identifier, status: "waiting" });

    if (id) return res.send({ message: "Done", details: id._id });

    res.send({ message: "Not found", details: null });

});

app.post("/validateAssociation", async (req: any, res) => {
    const { username, password, identifier } = req.body;

    const org = await Model.OrganizationID.findOne({
        identifier,
    });


    if (!org) return res.send({ message: "Error", details: "Invalid ID" });
    if (org.status === "used") return res.send({ message: "Error", details: "ID is already used" });

    const details = await Model.Organization.findOne({ organization_details_id: org.organization_details_id, organization_username: username });

    if (!details) return res.send({ message: "Error", details: "Incorrect username or password" });

    if (bcrypt.compareSync(password, details?.organization_password as string)) res.send({ message: "Done", details: { status: "valid", id: details.organization_details_id } });
    else return res.send({ message: "Error", details: "Incorrect username or password" })



});

app.post("/createConnection", async (req: any, res) => {
    const { ip, port, organization_id } = req.body;
    console.log(req.body)
    try {
        const { data } = await axios.get(`https://${ip}:${port}/ping`);

        if (data.message !== "Done" && data.details !== "pong") return res.send({ message: "Error", details: "Cannot ping the address and port provided" });

        const details = await Model.OrganizationDetails.findById(organization_id)

        if (!details) return res.send({ message: "Error", details: "Cannot find organization" });

        await details.updateOne({ organization_ip: ip, organization_port: port });

        const id = await Model.OrganizationID.findOne({ organization_details_id: organization_id, status: "waiting" });

        if (!details) return res.send({ message: "Error", details: "Cannot find organization" });

        await id?.update({ status: "used" })

        res.send({ message: "Done", details: "Host verified" });
    } catch (err: any) {
        console.log(err)
        res.send({ message: "Error", details: "Cannot ping the provided IP and port" });
    }

})

app.post("/channel", async (req, res) => {

    const { channelId, orgName, channelToMSP, host, port } = req.body;

    try {

        const channel = await axios.post(`https://${host}:${port}/channel`, {
            channelId,
            orgName,
            channelToMSP
        })

        res.send({ message: "Done", details: channel.data })

    } catch (error: any) {
        res.send({ message: "Error", details: error.message })
    }

});

app.get("/channels", async (req: any, res) => {

    try {

        const organization = await models.OrganizationDetails.findById(req.orgId);

        const channel = await axios.get(`https://${organization?.organization_ip}:${organization?.organization_port}/channels?orgName=${organization?.organization_name}&host=${organization?.organization_ip}`);

        res.send({ message: "Done", details: channel.data });

    } catch (error: any) {
        res.send({ message: "Error", details: error.message })
    }

})

app.post("/joinOrg", async (req: any, res) => {
    const { orgName, otherOrgName, channelId, creatorHost, receiverHost, orgType } = req.body;

    try {
        const { data } = await axios.post(`https://${creatorHost}/getChannelConfig`, {
            orgName,
            channelId
        })
        console.log(".")
        const { data: result } = await axios.post(`https://${receiverHost}/receiveChannelConfig`, {
            channelConfig: data.details.config.data,
            ordererTlsCa: data.details.ordererTlsCa.data,
            orgName: otherOrgName,
            otherOrgName: orgName,
            channelId,
            orgType
        })

        const { data: signed } = await axios.post(`https://${creatorHost}/signAndUpdateChannel`, {
            orgName,
            channelId,
            updateBlock: result.details.block.data,
            orgType
        })

        const { data: joined } = await axios.post(`https://${receiverHost}/joinChannelNow`, {
            channelId,
            ordererGeneralPort: signed.details.ordererGeneralPort,
            otherOrgName: orgName,
            orgName: otherOrgName,
            updateBlock: signed.details.block.data,
            ordererTlsCa: data.details.ordererTlsCa.data,
        })

        res.send({ joined });
    } catch (err: any) {
        res.send({ message: "Error", details: err.message })
    }

    // Get channel config from org that is already in the channel
})

app.post("/joinOrderer", async (req, res) => {
    const { orgName, otherOrgName, channelId, creatorHost, receiverHost, orgType } = req.body;

    try {
        const { data } = await axios.post(`https://${creatorHost}/getChannelConfig`, {
            orgName,
            channelId
        })
        console.log({ data })
        const { data: result } = await axios.post(`https://${receiverHost}/receiveChannelConfig`, {
            channelConfig: data.details.config.data,
            ordererTlsCa: data.details.ordererTlsCa.data,
            orgName: otherOrgName,
            otherOrgName: orgName,
            channelId,
            orgType
        })

        const { data: signed } = await axios.post(`https://${creatorHost}/signAndUpdateChannel`, {
            orgName,
            channelId,
            updateBlock: result.details.block.data,
            orgType
        })

        const { data: config } = await axios.post(`https://${creatorHost}/getChannelConfig`, {
            orgName,
            channelId
        })

        const { data: joined } = await axios.post(`https://${receiverHost}/joinOrdererNow`, {
            channelId,
            orgName: otherOrgName,
            channelConfig: config.details.config.data,
        })

        res.send({ joined });
    } catch (err: any) {
        res.send({ message: "Error", details: err.message })
    }

})

app.get("/organizations", getOrganizations);

app.get("/invitesReceived", invitesReceived)

app.get("/invitesSent", invitesSent)

app.put("/inviteResponse", inviteResponse);

app.put("/inviteConnect", inviteConnect);

app.get("/connectedOrganizations", connectedOrganizations);

app.post("/chaincode", performAction)

app.post("/inviteOu", inviteOu);

app.post("/getInviteOu", getInviteOu);

app.post("/acceptInviteOu", acceptInviteOu);

app.post("/rejectCancelInviteOu", rejectCancelInviteOu)

app.post("/cancelInviteOu", cancelInviteOu);

app.post("/rejectInviteOu", rejectInviteOu)

app.post("/switchToOu", switchToOu)

app.post("/getNotifs", getNotifs)

app.post("/viewedNotifs", viewedNotifs)

app.post("/sendEmailVerification", body("email").notEmpty().isEmail().escape(), sendEmailVerification)

app.post("/getEmailVerification", body("token").notEmpty(), getEmailValidation);

app.post("/validateEmailVerification", body("username").notEmpty(), body("password").notEmpty(), body("token").notEmpty(), validateEmailVerification);

app.post("/generateQr", generateQr);

mongoose.connect(`mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@supply-chain.9tknr9d.mongodb.net/?retryWrites=true&w=majority`).then(() => {
    console.log("Connected to database")
    httpServer.listen(process.env.PORT || 443, async () => {
        console.log(`Listening to port ${process.env.PORT || 443}`);
    })
}).catch((e) => {
    console.log(e);
    console.log("Cannot connect to database")
})

