import { Request, Response, Router } from "express";
import axios from "axios";

const router = Router();

export const setupCollectionConfig = async (req: Request, res: Response) => {

    let { hosts, msps } = req.body;

    try {

        const all = await Promise.all(hosts.map((host: any) => {
            return axios.post(`http://${host.host}:${host.port}/setup-collections-config`, {
                msps
            });
        }));

        res.send({ message: "Done", details: all.map(item => item.data) })

    } catch (error: any) {
        res.send({ message: "Error", details: error.message });
    }

}

export const installChaincode = async (req: Request, res: Response) => {

    const { hosts } = req.body;

    try {
        const all = await Promise.all(hosts.map((host: any) => {
            return axios.post(`http://${host.host}:${host.port}/installchaincode`, {
                channel: host.channel,
                hostname: host.hostname
            });
        }));


        res.send({ message: "Done", details: all.map(item => item.data) });
    } catch (err: any) {
        res.send({ mssage: "Error", details: err.message })
    }

}

export const approveChaincode = async (req: Request, res: Response) => {

    const { hosts } = req.body;

    try {
        const all = await Promise.all(hosts.map((host: any) => {
            return axios.post(`http://${host.host}:${host.port}/approvechaincode`, {
                channel: host.channel,
                hostname: host.hostname
            });
        }));


        res.send({ message: "Done", details: all.map(item => item.data) });
    } catch (err: any) {
        res.send({ mssage: "Error", details: err.message })
    }

}

export const collectAndTransferCa = async (req: Request, res: Response) => {

    const { hosts, host, port } = req.body;

    try {

        const all = await Promise.all(hosts.map((host: any) => {
            return axios.post(`http://${host.host}:${host.port}/collectandtransferca`, {
                hostname: host.hostname
            });
        }));

        const cas = all.map(item => item.data);

        const saved = await axios.post(`http://${host}:${port}/savetemporaryca`, {
            cas: cas[0]
        });


        res.send({ message: "Done", details: saved.data });

    } catch (err: any) {
        res.send({ mssage: "Error", details: err.message })
    }

}


export const checkCommitReadiness = async (req: Request, res: Response) => {

    const { hostname, channel, host } = req.body;

    try {
        const chaincode = await axios.post(`http://${host}:8012/checkcommitreadiness`, {
            channel,
            hostname
        });
        res.send({ message: "Done", details: chaincode.data })

    } catch (err: any) {
        res.send({ mssage: "Error", details: err.message })
    }

}

export const commitChaincode = async (req: Request, res: Response) => {

    const { hostname, channel, host, externals, port } = req.body;

    try {
        const chaincode = await axios.post(`http://${host}:${port}/commitchaincode`, {
            channel,
            hostname,
            externals
        });
        res.send({ message: "Done", details: chaincode.data })
    } catch (err: any) {
        res.send({ mssage: "Error", details: err.message })
    }

}

export const initializeChaincode = async (req: Request, res: Response) => {

    const { hostname, channel, host, externals } = req.body;

    try {
        const chaincode = await axios.post(`http://${host}:8012/initializechaincode`, {
            channel,
            hostname,
            externals
        });

        res.send({ message: "Done", details: chaincode.data })

    } catch (err: any) {
        res.send({ mssage: "Error", details: err.message })
    }

}
