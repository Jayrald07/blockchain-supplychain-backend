export const sleep = (seconds: number): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => resolve(true), seconds * 1000);
    })
}

const toDate = (data: string) => new Date(parseInt(data) * 1000)
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


