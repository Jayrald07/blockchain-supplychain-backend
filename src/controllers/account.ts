import { Request, Response } from "express";
import { isPasswordValid } from "../utils";
import Model from "../models";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import axios from "axios";

export const pingNode = async (req: any, res: Response) => {

    try {
        const organization = await Model.OrganizationDetails.findById(req.orgId).exec();

        if (!organization) return res.send({ messsage: "Error", details: "Cannot find organization" });
        const { data } = await axios.get(`http://${organization.organization_ip}:${organization.organization_port}/ping`);

        if (data.message === "Done" && data.details === "pong") return res.send({ message: "Done", details: "pong" });
        else res.send({ message: "Error", details: "cannot ping" })
    } catch (error: any) {
        res.send({ message: "Error", details: error.message });
    }

}

export const createOrganization = async (req: Request, res: Response) => {
    const { organization_name, organization_type_id, organization_address, organization_phone, organization_username, organization_password } = req.body;

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
}

export const authenticateAccount = async (req: any, res: Response) => {
    const { username, password } = req.body;
    try {
        const account = await Model.Organization.findOne({ organization_username: { $eq: username } });

        if (!account) return res.send({ message: "Error", details: "Invalid username or password" });

        const isEqual = await bcrypt.compare(password, account.organization_password as string);

        if (!isEqual) return res.send({ message: "Error", details: "Invalid username or password" });

        res.send({ message: "Authorized", token: jwt.sign({ username, organization_id: account.organization_details_id }, process.env.SECRET_KEY as string, { expiresIn: "1d" }) })


    } catch (e: any) {
        res.send({ message: "Error", details: e.message })
    }
}

export const getOrganizations = async (req: any, res: Response) => {
    try {

        const orgnization = await Model.OrganizationDetails.find({ _id: { $ne: req.orgId } }, { __v: 0 }).populate("organization_type_id").exec();

        res.send({ message: "Done", details: orgnization });

    } catch (error: any) {
        res.send({ message: "Error", details: error.message })
    }
}