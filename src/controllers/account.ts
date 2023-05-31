import { Request, Response } from "express";
import { isPasswordValid } from "../utils";
import Model from "../models";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import axios from "axios";
import { generateKeyPairSync, randomUUID } from "crypto"
import { createKeys, encryptSymData } from "../utils/general";
import { notify, sendMail, validateJwt } from "../helpers";
import { matchedData, validationResult } from "express-validator";
import winston from "winston"

export const pingNode = async (req: any, res: Response) => {

    try {
        const organization = await Model.OrganizationDetails.findById(req.orgId).exec();

        if (!organization) return res.send({ messsage: "Error", details: "Cannot find organization" });
        const { data } = await axios.get(`https://${organization.organization_ip}:${organization.organization_port}/ping`);

        if (data.message === "Done" && data.details === "pong") return res.send({ message: "Done", details: "pong" });
        else res.send({ message: "Error", details: "cannot ping" })
    } catch (error: any) {
        res.send({ message: "Error", details: error.message });
    }

}

export const setupClient = async (req: any, res: Response) => {

    try {

        const { username, password } = req.body;

        const access_code = randomUUID().toString();

        const client = await Model.Client.findOne({ username });

        if (client) throw new Error("Username taken");

        const encryptedPass = bcrypt.hashSync(password, 10);

        const newClient = new Model.Client({
            username,
            password: encryptedPass,
            access_code
        });

        newClient.save();

        res.send({
            message: "Done", details: {
                access_code
            }
        })

    } catch (error: any) {

        res.send({ message: "Error", details: error.message });

    }

}

export const authClient = async (req: any, res: Response) => {

    try {

        const { username, password } = req.body;


        const client = await Model.Client.findOne({ username });

        if (!client) throw new Error("Invalid username or password");

        const isPasswordValid = bcrypt.compareSync(password, client.password as string);

        if (!isPasswordValid) throw new Error("Invalid username or password");

        res.send({ message: "Authorized", token: jwt.sign({ username, client_id: client.id }, process.env.SECRET_KEY as string, { expiresIn: "1d" }) })

    } catch (error: any) {

        res.send({ message: "Error", details: error.message })

    }

}

export const getClient = async (req: any, res: Response) => {

    try {

        if (!req.headers.authorization) throw new Error("Unauthorized")

        const token = req.headers.authorization?.split(" ")[1] as string;

        const decoded = jwt.verify(token, process.env.SECRET_KEY as string) as any;

        res.send({
            message: "Done",
            details: decoded
        })

    } catch (error: any) {

        res.send({ message: "Error", details: error.message })

    }

}

export const updateClient = async (req: any, res: Response) => {

    try {

        const { username, password } = req.body;

        const client = await Model.Client.findById(req.clientId);

        if (!client) throw new Error("Cannot find client");

        const newPassword = bcrypt.hashSync(password, 10);

        await client.updateOne({
            username,
            password: newPassword
        })

        res.send({ message: "Done", details: "Client updated!" });

    } catch (error: any) {

        res.send({ message: "Error", details: error.message })

    }

}

export const createOrganization = async (req: Request, res: Response) => {
    const { organization_name, organization_type_id, organization_address, organization_phone, organization_username, organization_password } = req.body;

    try {

        const result = isPasswordValid(organization_password);
        const { publicKey, privateKey } = await createKeys(organization_name, `${organization_name}@chaindirect.com`);

        if (Object.keys(result).length) return res.json({ message: result });

        const account = await Model.Organization.findOne({ organization_username: { $eq: organization_username } })

        if (account) return res.json({ message: "Username already taken" });

        const newPassword = await bcrypt.hash(organization_password, 10);

        const organizationDetails = new Model.OrganizationDetails({
            organization_name,
            organization_address,
            organization_phone,
            organization_type_id,
            organization_pubkey: encryptSymData(publicKey),
            organization_privkey: encryptSymData(privateKey)
        })

        const response = await organizationDetails.save();

        const organization = new Model.Organization({
            organization_username,
            organization_password: newPassword,
            organization_details_id: response._id,
            organization_type: "ADMIN"
        })

        await organization.save();
        res.json({ message: "Organization created!" })
    } catch (e: any) {
        res.send({ message: "Error!", details: e.message })
    }
}

export const authenticateAccount = async (req: any, res: Response) => {
    const { username, password } = req.body;
    const logger: winston.Logger = req.logger;
    try {
        const account = await Model.Organization.findOne({ organization_username: { $eq: username } });


        if (!account) {
            logger.info("Username not existing")
            return res.send({ message: "Error", details: "Invalid username or password" });
        }

        const isEqual = await bcrypt.compare(password, account.organization_password as string);

        if (!isEqual) {
            logger.info("Not equal password")
            return res.send({ message: "Error", details: "Invalid username or password" });
        }


        logger.info(`${username} has signed in`)
        res.send({ message: "Authorized", token: jwt.sign({ username, organization_id: account.organization_details_id }, process.env.SECRET_KEY as string, { expiresIn: "1d" }) })


    } catch (e: any) {
        logger.error(e.message)
        res.send({ message: "Error", details: e.message })
    }
}

export const createUser = async (req: any, res: Response) => {
    try {

        const orgId = req.orgId;
        const { username, email } = req.body;




    } catch (error: any) {
        res.send({ message: "Error", details: error.message })
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

export const inviteOu = async (req: any, res: any) => {

    try {
        if (!req.body.username.trim()) return res.send({ message: "Error", details: "Username should not be empty" })

        const org = await Model.Organization.findOne({ organization_username: req.body.username.trim() });

        if (org?.organization_details_id?.toString() === req.orgId) return res.send({ message: "Error", details: "You cannot invite yourself" })

        if (!org) return res.send({ message: "Error", details: 'Cannot find username' });

        const existingOrg = await Model.OrganizationOU.findOne({
            organization_details_id: org.organization_details_id,
            organization_id: req.orgId,
            status: { $in: ['PENDING', 'INVITED'] }
        })

        if (existingOrg) return res.send({ message: "Error", details: "Already invited" });

        const response = new Model.OrganizationOU({
            status: "PENDING",
            organization_details_id: org.organization_details_id,
            organization_id: req.orgId
        });

        const result = await response.save();

        const requester = await Model.OrganizationDetails.findById(req.orgId);

        const notif = await notify(req.io, "account", { action: 'refetch' }, org.organization_details_id?.toString() as string, "OU Invitation Request", `${requester?.organization_name} is requesting you to be OU`);

        if (result) return res.send({ message: "Done", details: 'Invitation Sent' });
        else return res.send({ message: "Error", details: "Encountered a problem. Please try again." })
    } catch (error: any) {
        res.send({ message: "Error", details: error.message })
    }

}

export const getInviteOu = async (req: any, res: any) => {

    try {

        if (!req.body.received) {
            const invites = await Model.OrganizationOU.find({ organization_id: req.orgId, status: req.body.status }).populate({
                path: 'organization_details_id',
                populate: { path: 'organization_type_id' }
            }).exec();
            res.send({ message: "Done", details: invites })
        } else {
            const invites = await Model.OrganizationOU.find({ organization_details_id: req.orgId, status: req.body.status }).populate({
                path: 'organization_id',
                populate: { path: 'organization_type_id' }
            }).exec();
            res.send({ message: "Done", details: invites })
        }


    } catch (error: any) {
        res.send({ message: "Error", details: error.message })
    }

}

export const acceptInviteOu = async (req: any, res: any) => {

    try {
        const inviteOu = await Model.OrganizationOU.findById(req.body.inviteOuId);

        if (!inviteOu) return res.send({ message: "Error", details: 'Cannot find the invite' });

        if (inviteOu.organization_details_id != req.orgId) return res.send({ message: "Error", details: 'Unauthorized action' });

        const update = await inviteOu.updateOne({ status: 'INVITED' });

        const org = await Model.OrganizationDetails.findById(inviteOu.organization_details_id);

        const notif = await notify(req.io, "account", { action: 'refetch' }, inviteOu.organization_id?.toString() as string, "OU Invitation Accepted", `${org?.organization_name} accepted your invitation`);

        if (update) res.send({ message: "Done", details: 'Accepted invite' });
        else res.send({ message: "Error", details: 'Error accepting invite' })
    } catch (error: any) {
        res.send({ message: "Error", details: error.message })
    }

}

export const rejectCancelInviteOu = async (req: any, res: any) => {

    try {
        const inviteOu = await Model.OrganizationOU.findById(req.body.inviteOuId);

        if (!inviteOu) return res.send({ message: "Error", details: 'Cannot find the invite' });

        // if (inviteOu.organization_details_id != req.orgId) return res.send({ message: "Error", details: 'Unauthorized action' });

        const update = await inviteOu.updateOne({ status: 'DELETED' });

        const org = await Model.OrganizationDetails.findById(inviteOu.organization_id);

        const notif = await notify(req.io, "account", { action: 'refetch' }, inviteOu.organization_details_id?.toString() as string, "OU Detached", `${org?.organization_name} has removed you as OU`);

        if (update) res.send({ message: "Done", details: 'Removing invite' });
        else res.send({ message: "Error", details: 'Error removing invite' })
    } catch (error: any) {
        res.send({ message: "Error", details: error.message })
    }

}

export const rejectInviteOu = async (req: any, res: any) => {

    try {
        const inviteOu = await Model.OrganizationOU.findById(req.body.inviteOuId);

        if (!inviteOu) return res.send({ message: "Error", details: 'Cannot find the invite' });

        const update = await inviteOu.updateOne({ status: 'REJECTED' });

        const org = await Model.OrganizationDetails.findById(inviteOu.organization_details_id);

        const notif = await notify(req.io, "account", { action: 'refetch' }, inviteOu.organization_id?.toString() as string, "OU Invitation Rejected", `${org?.organization_name} rejected your invitation`);


        if (update) res.send({ message: "Done", details: 'Invite rejected' });
        else res.send({ message: "Error", details: 'Error rejecting invite' })
    } catch (error: any) {
        res.send({ message: "Error", details: error.message })
    }

}

export const cancelInviteOu = async (req: any, res: any) => {

    try {
        const inviteOu = await Model.OrganizationOU.findById(req.body.inviteOuId);

        if (!inviteOu) return res.send({ message: "Error", details: 'Cannot find the invite' });

        const update = await inviteOu.updateOne({ status: 'CANCELED' });

        const org = await Model.OrganizationDetails.findById(inviteOu.organization_id);

        const notif = await notify(req.io, "account", { action: 'refetch' }, inviteOu.organization_details_id?.toString() as string, "OU Invitation Cancelled", `${org?.organization_name} has cancelled the invitation`);

        if (update) res.send({ message: "Done", details: 'Invite canceled' });
        else res.send({ message: "Error", details: 'Error cancelling invite' })
    } catch (error: any) {
        res.send({ message: "Error", details: error.message })
    }

}

export const switchToOu = async (req: any, res: any) => {

    try {
        const inviteOu = await Model.OrganizationOU.findById(req.body.inviteOuId);

        if (!inviteOu) return res.send({ message: "Error", details: 'Cannot find invite' });

        const org = await Model.Organization.findOne({ organization_details_id: inviteOu?.organization_id })

        if (!org) return res.send({ message: 'Error', details: 'Organization is not existing' });

        const updateOrg = await Model.OrganizationDetails.findById(inviteOu.organization_id);

        const notif = await notify(req.io, "account", { action: 'refetch' }, inviteOu.organization_details_id?.toString() as string, "Account accessed", `Your account has been accessed by ${org.organization_username}`);

        res.send({ message: "Switched", token: jwt.sign({ username: org.organization_username, organization_id: inviteOu.organization_details_id, accessedById: inviteOu.organization_id?.toString() }, process.env.SECRET_KEY as string, { expiresIn: "1d" }) })
    } catch (error: any) {
        res.send({ message: 'Error', details: error.message })
    }

}


export const validateSwitched = async (req: any, res: any) => {
    try {

        res.send({ message: "Done", details: req.accessedById })

    } catch (error: any) {
        res.send({ message: "Error", details: error.message })
    }
}

export const switchBack = async (req: any, res: any) => {
    try {

        const { accessedById } = req;

        if (accessedById) {

            const org = await Model.Organization.findOne({ organization_details_id: accessedById });

            if (!org) return res.send({ message: "Error", details: 'Account not found' })

            res.send({ message: "Done", token: jwt.sign({ username: org?.organization_password, organization_id: org?.organization_details_id }, process.env.SECRET_KEY as string, { expiresIn: "1d" }) })

        } else res.send({ message: "Error", details: 'Cannot switched back' })

    } catch (error: any) {
        res.send({ message: "Error", details: error.message })
    }
}

export const getNotifs = async (req: any, res: any) => {

    try {

        const notifs = await Model.Notification.find({ organization_id: req.orgId, viewed: { $in: req.body.viewed } })

        let length = notifs.length;

        let _notifDetails = await Model.Notification.find({ organization_id: req.orgId, viewed: { $in: req.body.viewed } }).skip(req.body.skip).limit(req.body.limit).sort({ createdAt: -1 })

        res.send({ message: "Done", details: { length, notifs: _notifDetails } })

    } catch (error: any) {
        res.send({ message: "Error", details: error.message })
    }

}

export const viewedNotifs = async (req: any, res: any) => {

    try {

        const notifs = await Model.Notification.updateMany({
            organization_id: req.orgId,
            viewed: false
        }, { $set: { viewed: true } })

        if (!notifs) return res.send({ message: "Error", details: 'Error updating notification' })

        res.send({ message: "Done", details: 'Notification viewed' })

    } catch (error: any) {
        res.send({ message: "Error", details: error.message })
    }

}

export const sendEmailVerification = async (req: any, res: any) => {
    try {
        const result = validationResult(req);

        if (!result.isEmpty()) return res.send({ message: "Error", details: result.array() })

        const validated = matchedData(req);

        const emailOrgs = await Model.OrganizationDetails.find({ organization_email: validated.email })

        if (emailOrgs.length) return res.send({ message: "Error", details: 'Email already used' })

        const org = await Model.OrganizationDetails.findById(req.orgId);

        await org?.updateOne({ $set: { organization_email: validated.email, organization_email_is_verified: false } })

        let verificationLink = '';

        const verify = await Model.Verification.findOne({
            organization_id: req.orgId,
            status: 'PENDING'
        })

        if (verify) {
            const status = await validateJwt(verify.token as string);

            if (status.details.includes('expired')) {

                let token = jwt.sign({ action: 'for-email-verification' }, process.env.SECRET_KEY as string, { expiresIn: '1h' });

                await verify.updateOne({ $set: { token } });

                verificationLink = `${process.env.FRONTEND_URL}/email-verification?token=${token}`

            } else {

                verificationLink = `${process.env.FRONTEND_URL}/email-verification?token=${verify.token}`

            }


            const data = await sendMail(validated.email, "Email Verification", 'email-verification', {
                orgName: org?.organization_name,
                verificationLink
            });

            return res.send(data);
        }

        const token = jwt.sign({ action: 'for-email-verification' }, process.env.SECRET_KEY as string, { expiresIn: '1h' });

        const verification = new Model.Verification({
            token,
            organization_id: req.orgId,
            email: validated.email,
            status: 'PENDING'
        })

        const _verification = await verification.save();

        if (!_verification) return res.sed({ message: "Error", details: 'Error saving verification' })

        verificationLink = `https://chainblockdirect.live/email-verification?token=${token}`

        const data = await sendMail(validated.email, "Email Verification", 'email-verification', {
            orgName: org?.organization_name,
            verificationLink
        });

        res.send(data)
    } catch (error: any) {

        res.send({ message: "Error", details: error.message })
    }
}

export const getEmailValidation = async (req: any, res: any) => {
    try {

        const result = validationResult(req);

        if (!result.isEmpty()) return res.send({ message: "Error", details: result.array() })

        const validated = matchedData(req);

        const verification = await Model.Verification.findOne({ token: validated.token, status: 'PENDING' });

        if (!verification) return res.send({ message: "Error", details: 'Not Existing' })

        const status = await validateJwt(validated.token as string);

        if (status.details.includes("expired")) return res.send({ message: "Error", details: 'Token expired' })

        res.send({ message: "Done", details: 'Exists' })

    } catch (error: any) {

        res.send({ message: "Error", details: error.message })

    }
}

export const validateEmailVerification = async (req: any, res: any) => {

    try {

        const result = validationResult(req);

        if (!result.isEmpty()) return res.send({ message: "Error", details: result.array() })

        const validated = matchedData(req);

        const verification = await Model.Verification.findOne({ token: validated.token, status: 'PENDING' });

        if (!verification) return res.send({ message: "Error", details: 'Token might be not existing or the link is already used' });

        const credent = await Model.Organization.findOne({ organization_username: validated.username });

        if (!credent) return res.send({ message: "Error", details: 'Invalid username or password' });

        if (verification.organization_id?.toString() !== credent.organization_details_id?.toString()) return res.send({ message: 'Error', details: 'Unauthorized action' });

        const isEqual = await bcrypt.compare(validated.password, credent.organization_password as string);

        if (!isEqual) return res.send({ message: "Error", details: 'Invalidate username or password' });

        let updateVerification = await verification.updateOne({ $set: { status: 'DONE' } });

        if (!updateVerification) return res.send({ message: "Error", details: 'Error updating the verification' });

        const org = await Model.OrganizationDetails.findByIdAndUpdate(verification.organization_id, { $set: { organization_email_is_verified: true, organization_email: verification.email } });

        if (!org) return res.send({ message: "Error", details: 'Error updating email' });

        await verification.deleteOne();

        await notify(req.io, "account", { action: 'refetch' }, verification.organization_id?.toString() as string, 'Email verified', `${verification.email} has been verified`)

        res.send({ message: "Done", details: 'Verified!' });

    } catch (error: any) {

        res.send({ message: "Error", details: error.message })

    }

}