import express from "express";
import dotenv from "dotenv";
import { blockchainInit } from "./src/controllers/blockchain";
import { Contract, Gateway } from "@hyperledger/fabric-gateway";
import { closeGRPCConnection, createAsset, getAllAssets, getAssetProvenance, isPasswordValid, readAssetByID, updateAsset } from "./src/utils";
import { Client } from "@grpc/grpc-js";
import { v4 } from "uuid";
import Model from "./src/models/index";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import QRCode from "qrcode";
import cors from "cors"
import axios from "axios"

dotenv.config();


const app = express();

app.use(cors({
    origin: "*"
}))

app.use(express.json());
app.use(express.urlencoded({ extended: false }))


app.post("/asset", async (req, res) => {
    const { asset_name, tags, asset_description }: { asset_name: string, tags: any[], asset_description: string } = req.body;
    let tag = null, tag_code = v4(), token = req.headers["authorization"]?.split(" ")[1];

    try {
        console.log(req.body)
        const payload: any = jwt.verify(token as string, process.env.SECRET_KEY as string)

        if (tags.length) {
            for (let t of tags) {
                t.tag_code = tag_code;
                tag = new Model.Tag(t);
                await tag?.save()
            }
        }

        const asset = new Model.Asset({ asset_name, tag_code, asset_description, asset_uuid: v4().replaceAll("-", "") })
        const response = await asset.save();

        const org_asset = await Model.OrganizationAsset.findOne({ organization_details_id: { $eq: payload.organization_id as string } })

        if (org_asset) {
            await org_asset.updateOne({ $push: { asset_id: response._id } })
        } else {
            await new Model.OrganizationAsset({
                organization_details_id: payload.organization_id,
                asset_id: [response._id],
            }).save();
        }

        res.send({ message: "asset created" })
    } catch (e: any) {
        res.send({ message: "Error", details: e.message })
    }
});

app.post("/organization", async (req, res) => {
    const { organization_name, organization_type_id, organization_address, organization_phone, organization_username, organization_password } = req.body;
    console.log(req.body)
    try {

        const result = isPasswordValid(organization_password);

        if (Object.keys(result).length) return res.json({ message: result });

        const account = await Model.Organization.findOne({ organization_username: { $eq: organization_username } })

        if (account) return res.json({ message: "Username already taken" });

        const newPassword = await bcrypt.hash(organization_password, 10);

        const organizationDetails = new Model.OrganizationDetails({
            organization_name,
            organization_address,
            organization_phone,
            organization_type_id
        })

        const response = await organizationDetails.save();

        const organization = new Model.Organization({
            organization_username,
            organization_password: newPassword,
            organization_details_id: response._id
        })

        await organization.save();
        res.json({ message: "Organization created!" })
    } catch (e: any) {
        res.send({ message: "Error!", details: e.message })
    }
});

app.post("/auth", async (req, res) => {
    const { username, password } = req.body;
    console.log(req.body)
    try {
        const account = await Model.Organization.findOne({ organization_username: { $eq: username } });

        if (!account) return res.send({ message: "Invalid username or password" });

        const isEqual = await bcrypt.compare(password, account.organization_password as string);

        if (!isEqual) return res.send({ message: "Invalid username or password" });

        res.send({ message: "Authorized", token: jwt.sign({ username, organization_id: account.organization_details_id }, process.env.SECRET_KEY as string, { expiresIn: "1d" }) })


    } catch (e: any) {
        res.send({ message: "Error!", details: e.message })
    }
})

app.get("/assets", async (req: any, res) => {
    const count = await Model.Asset.find({ isDelete: 0 }).count();
    const page = req.query.page

    if (page > Math.ceil(count / 10)) return res.send({ message: "out of bound" })

    const assets = await Model.Asset.find({ isDelete: 0 }, { isDelete: 0, __v: 0 }).skip((parseInt(page) - 1) * 10).limit(10)

    res.send({ page: parseInt(page), pageCount: Math.ceil(count / 10), assets, count })
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

app.delete("/tag/:tag_id", async (req, res) => {
    const { tag_id } = req.params;

    const tag = await Model.Tag.findById(tag_id);

    if (!tag) return res.send({ message: "Tag is not existing" });

    await tag.deleteOne();

    res.send({ message: "Tag deleted!" });

})

app.post("/tag", async (req, res) => {
    const { tag_code, tags } = req.body;

    for (let tag of tags) {
        const response = new Model.Tag({
            tag_key: tag.tag_key,
            tag_value: tag.tag_value,
            tag_code
        });
        await response.save();
    }

    res.send({ message: "Tags created" });

})

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

    res.send({ ...organization?.toJSON(), username: payload.username });

});

app.put("/account", async (req: any, res) => {
    const token = req.headers.authorization.split(" ")[1];

    const payload: any = jwt.decode(token);

    const organization = await Model.OrganizationDetails.findById(payload.organization_id)

    if (!organization) return res.send({ message: "Account is not existing." });

    await organization.updateOne(req.body);

    res.send({ message: "Account updated!" });

});

app.get("/search/asset/:name", async (req: any, res) => {
    const { name } = req.params


    const asset = await Model.Asset.find({ asset_name: new RegExp((name === "all" ? "" : name)), isDelete: 0 }, { __v: 0, isDelete: 0 });

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

        if (checkName) return res.send({ message: "Error", details: "Username already taken" });

        const checkPass = isPasswordValid(password);

        if (Object.keys(checkPass).length) return res.send({
            message: "Error",
            details: checkPass
        })

        const details = new Model.OrganizationDetails({
            organization_name,
            organization_type_id: organization_type,
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
        res.send({ message: "Error", details: err.message });
    }

})

app.post("/validateID", async (req: any, res) => {
    const { identifier } = req.body;

    const id = await Model.OrganizationID.findOne({ identifier });

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

    const details = await Model.Organization.findOne({ organization_username: username })

    if (!details) return res.send({ message: "Error", details: "Username is not existing" });

    if (bcrypt.compareSync(password, details?.organization_password as string)) await org.updateOne({ status: "used" });
    else return res.send({ message: "Error", details: "Incorrect username or password" })

    res.send({ message: "Done", details: { status: "valid", id: details._id } });

});

app.post("/createConnection", async (req: any, res) => {
    const { ip, port, organization_id } = req.body;

    try {
        const { data } = await axios.get(`http://${ip}:${port}/ping`);

        if (data.message !== "Done" && data.details !== "pong") return res.send({ message: "Error", details: "Cannot ping the address and port provided" });

        const details = await Model.OrganizationDetails.findById(organization_id)

        if (!details) return res.send({ message: "Error", details: "Cannot find organization" });

        await details.updateOne({ organization_ip: ip, organization_port: port });

        res.send({ message: "Done", details: "Host verified" });
    } catch (err: any) {
        res.send({ message: "Error", details: "Cannot ping the provided IP and port" });
    }

})

// app.get("/assets", async (req, res) => {
//     try {
//         const blockchain = await blockchainInit();

//         res.status(200).json(await getAllAssets(blockchain?.[2] as Contract))

//         if (await closeGRPCConnection(blockchain?.[0] as Gateway, blockchain?.[1] as Client)) console.log("Disconnected")
//     } catch (e) {
//         res.send(e);
//     }
// })

// app.get("/asset/:id", async (req, res) => {

//     try {
//         const blockchain = await blockchainInit();

//         res.status(200).json(await readAssetByID(blockchain?.[2] as Contract, req.params.id))

//         if (await closeGRPCConnection(blockchain?.[0] as Gateway, blockchain?.[1] as Client)) console.log("Disconnected")

//     } catch ({ details, message }: any) {
//         res.send({ message, details })
//     }

// })

// app.get("/provenance/:id", async (req, res) => {
//     const blockchain = await blockchainInit();

//     res.status(200).json(await getAssetProvenance(blockchain?.[2] as Contract, req.params.id))

//     if (await closeGRPCConnection(blockchain?.[0] as Gateway, blockchain?.[1] as Client)) console.log("Disconnected")
// })

// app.post("/asset", async (req, res) => {
//     // const blockchain = await blockchainInit();
//     // const { color, owner, size } = req.body;

//     // res.status(200).json(await createAsset(blockchain?.[2] as Contract, {
//     //     id: v4().split("-").join(""),
//     //     color,
//     //     owner,
//     //     size
//     // }))

//     // if (await closeGRPCConnection(blockchain?.[0] as Gateway, blockchain?.[1] as Client)) console.log("Disconnected")
// })

// app.put("/asset/:id", async (req, res) => {
//     const blockchain = await blockchainInit();
//     const { color, size, owner } = req.body
//     const id = req.params.id

//     res.status(200).json(await updateAsset(blockchain?.[2] as Contract, { color, size, id, owner }))

//     if (await closeGRPCConnection(blockchain?.[0] as Gateway, blockchain?.[1] as Client)) console.log("Disconnected")

// })

// app.put("/transfer/:id", async (req, res) => {
//     // Needs a thorough reading
//     console.log("See! It works!")

// })

mongoose.connect(`mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@supply-chain.9tknr9d.mongodb.net/?retryWrites=true&w=majority`).then(() => {
    console.log("Connected to database")
    app.listen(process.env.PORT || 8081, async () => {
        console.log(`Listening to port ${process.env.PORT || 8081}`);
    })

}).catch((e) => {
    console.log("Cannot connect to database")
})

