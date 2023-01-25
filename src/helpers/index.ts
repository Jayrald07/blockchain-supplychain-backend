export const toAssetJSON = (data: Array<any>): any => {
    console.log(data);
    if (Array.isArray(data)) {
        data.map(asset => {
            if (asset.timestamp && asset.data) {
                asset.timestamp.seconds = toDate(asset.timestamp.seconds)
                asset.data = JSON.parse(asset.data)
            }
        })
    }
    return data;
}

const toDate = (data: string) => new Date(parseInt(data) * 1000)