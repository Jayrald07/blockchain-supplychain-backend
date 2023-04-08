import axios from "axios";

export const joinOrder = async (body: any) => {
    const { orgName, otherOrgName, channelId, creatorHost, receiverHost, orgType } = body;

    try {
        const { data } = await axios.post(`http://${creatorHost}/getChannelConfig`, {
            orgName,
            channelId
        })

        const { data: result } = await axios.post(`http://${receiverHost}/receiveChannelConfig`, {
            channelConfig: data.details.config.data,
            ordererTlsCa: data.details.ordererTlsCa.data,
            orgName: otherOrgName,
            otherOrgName: orgName,
            channelId,
            orgType
        })

        const { data: signed } = await axios.post(`http://${creatorHost}/signAndUpdateChannel`, {
            orgName,
            channelId,
            updateBlock: result.details.block.data,
            orgType
        })

        const { data: config } = await axios.post(`http://${creatorHost}/getChannelConfig`, {
            orgName,
            channelId
        })

        const { data: joined } = await axios.post(`http://${receiverHost}/joinOrdererNow`, {
            channelId,
            orgName: otherOrgName,
            channelConfig: config.details.config.data,
        })

        return { joined };
    } catch (err: any) {
        return err.message;
    }
}

export const joinOrg = async (body: any) => {
    const { orgName, otherOrgName, channelId, creatorHost, receiverHost, orgType } = body;

    try {
        const { data } = await axios.post(`http://${creatorHost}/getChannelConfig`, {
            orgName,
            channelId
        })

        const { data: result } = await axios.post(`http://${receiverHost}/receiveChannelConfig`, {
            channelConfig: data.details.config.data,
            ordererTlsCa: data.details.ordererTlsCa.data,
            orgName: otherOrgName,
            otherOrgName: orgName,
            channelId,
            orgType
        })

        const { data: signed } = await axios.post(`http://${creatorHost}/signAndUpdateChannel`, {
            orgName,
            channelId,
            updateBlock: result.details.block.data,
            orgType
        })

        const { data: joined } = await axios.post(`http://${receiverHost}/joinChannelNow`, {
            channelId,
            ordererGeneralPort: signed.details.ordererGeneralPort,
            otherOrgName: orgName,
            orgName: otherOrgName,
            updateBlock: signed.details.block.data,
            ordererTlsCa: data.details.ordererTlsCa.data,
        })

        return { joined };
    } catch (err: any) {
        return err.message;
    }

}