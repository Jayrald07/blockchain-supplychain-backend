import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import express from "express";
import models from "../models";
import moment from "moment";


export class IOServer {

    public io: Server;
    public route: express.Router;

    constructor(io: Server) {
        this.io = io;
        this.init();
        this.route = express.Router();
        this.initRoute();
    }

    initRoute() {
        this.route.post("/sendWs", async (req: any, res) => {
            // invitedId here is the organization that will be invited.
            const { invitedId } = req.body;

            let invitation = await models.Invite.findOne({
                organization_id: req.orgId,
                invited_organization_id: invitedId
            });

            if (invitation) return res.send({ message: "Error", details: "Already sent invitation" })

            invitation = await models.Invite.findOne({
                organization_id: invitedId,
                invited_organization_id: req.orgId
            });

            if (invitation) return res.send({ message: "Error", details: "Already sent invitation" })

            invitation = new models.Invite({
                organization_id: req.orgId,
                invited_organization_id: invitedId,
                expiresIn: moment().add('1', 'day')
            })

            const result = await invitation.save();

            if (result) {
                this.io.in(invitedId).emit("channelInvite", true);
                res.send({ message: "Done", details: "Invitation sent!" })
            } else res.send({ message: "Error", details: 'Cannot create invitation.' })

        })
    }

    init() {
        this.io.use((socket: Socket, next) => {
            if (socket.handshake.query.token) {
                const token = socket.handshake.query.token as string
                const secret = process.env.SECRET_KEY as string
                jwt.verify(token, secret, (err, decoded) => {
                    if (err) return next(new Error("Not Authorized"));
                    (socket as any).decoded = decoded
                    console.log("Connected!")
                    next();
                })
            } else next(new Error("Not Authorized"));
        }).on("connection", (socket: Socket) => {
            const session = (socket as any).decoded;
            socket.join(session.organization_id);
        })
    }
}