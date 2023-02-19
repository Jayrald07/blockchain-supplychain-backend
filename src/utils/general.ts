export const sleep = (seconds: number): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => resolve(true), seconds * 1000);
    })
}