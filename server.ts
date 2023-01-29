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



dotenv.config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }))



app.post("/asset", async (req, res) => {
    const { asset_name, tags }: { asset_name: string, tags: any[] } = req.body;
    let tag = null, tag_code = v4(), token = req.headers["authorization"]?.split(" ")[1];

    try {

        const payload: any = jwt.verify(token as string, process.env.SECRET_KEY as string)

        if (tags.length) {
            for (let t of tags) {
                t.tag_code = tag_code;
                tag = new Model.Tag(t);
                await tag?.save()
            }
        }

        const asset = new Model.Asset({ asset_name, tag_code, asset_uuid: v4().replaceAll("-", "") })
        const response = await asset.save();

        const org_asset = await Model.OrganizationAsset.findOne({ organization_details_id: { $eq: payload.organization_id as string } })

        if (org_asset) {
            await org_asset.updateOne({ $push: { asset_id: response._id } })
        } else {
            await new Model.OrganizationAsset({
                organization_details_id: payload.organization_id,
                asset_id: [response._id]
            }).save();
        }

        res.send({ message: "asset created" })
    } catch (e: any) {
        res.send({ message: "Error", details: e.message })
    }
});

app.post("/organization", async (req, res) => {
    const { organization_name, organization_type_id, organization_address, organization_phone, organization_username, organization_password } = req.body;

    try {

        const result = isPasswordValid(organization_password);

        if (Object.keys(result).length) return res.send({ message: result });

        const account = await Model.Organization.findOne({ organization_username: { $eq: organization_username } })

        if (account) return res.send({ message: "Username already taken" });

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
        res.send({ message: "Organization created!" })
    } catch (e: any) {
        res.send({ message: "Error!", details: e.message })
    }
});

app.post("/auth", async (req, res) => {
    const { username, password } = req.body;

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
    const count = await Model.Asset.count();
    const page = req.query.page

    if (page > Math.ceil(count / 10)) return res.send({ message: "out of bound" })

    const assets = await Model.Asset.find().skip((parseInt(page) - 1) * 10).limit(10)

    res.send({ page: parseInt(page), pageCount: Math.ceil(count / 10), assets })
})

app.put("/asset", async (req, res) => {
    const { asset_id, asset_name } = req.body;

    const asset = await Model.Asset.findById(asset_id)

    if (!asset) return res.send({ message: "Asset is not existing" });

    await Model.Asset.findByIdAndUpdate(asset_id, { asset_name });

    res.send({ message: "Asset updated!" });

})

app.get("/asset/:asset_id", async (req, res) => {
    const asset_id = req.params.asset_id;

    const asset = await Model.Asset.findById(asset_id, { __v: 0, _id: 0 });

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

