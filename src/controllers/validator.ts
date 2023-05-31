import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const blacklistedPaths = [
    "/auth",
    "/types",
    "/external",
    "/validateID",
    "/validateAssociation",
    "/createConnection",
    "/getEmailVerification",
    "/validateEmailVerification",
    "/createNode",
    "/getAssetHistory",
    "/setupClient",
    "/authClient",
    "/getClient",
    "/updateClient"
]

export const validateJson = async (req: any, _: any, next: NextFunction) => {

    try {

        if (blacklistedPaths.includes(req.path)) return next();

        if (!req.headers.authorization) next('Unauthorized');

        const token = req.headers.authorization?.split(" ")[1] as string;


        const decoded = jwt.verify(token, process.env.SECRET_KEY as string) as any;

        req.decoded = decoded;

        req.orgId = decoded.organization_id;
        req.accessedById = decoded.accessedById || null

        next();

    } catch (error: any) {
        next(error.message);
    }

}

export const validateClient = async (req: any, _: any, next: NextFunction) => {

    try {

        if (!req.headers.authorization) next('Unauthorized');

        const token = req.headers.authorization?.split(" ")[1] as string;


        const decoded = jwt.verify(token, process.env.SECRET_KEY as string) as any;

        req.decoded = decoded;

        req.clientId = decoded.client_id;

        next();

    } catch (error: any) {
        next(error.message);
    }

}